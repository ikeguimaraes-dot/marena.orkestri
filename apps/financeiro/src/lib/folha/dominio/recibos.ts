import type { DominioCompetencia, DominioParseResultado, PositionedText } from './types';
const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const money = /^-?[\d.]+,\d{2}$/;
const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const soma = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
// Recibos Domínio têm duas vias; a identidade é empresa + competência + matrícula.
export function parseRecibosItems(arquivoOrigem: string, pages: PositionedText[][]): DominioParseResultado {
    const competencias = new Map<string, DominioCompetencia>();
    const vistos = new Map<string, string>();
    type Rubrica = {
        codColaborador: number;
        rubricaCodigo: number;
        valor: number;
        natureza: "PROVENTO" | "DESCONTO";
        descricao: string;
    };
    const pendentes = new Map<string, Rubrica[]>();
    const partes = new Set<string>();
    for (const [pageIndex, page] of pages.entries()) {
        if (!page.length)
            throw new Error(`Página ${pageIndex + 1}: sem texto legível.`);
        const headers = page.filter(i => i.text.trim() === 'CNPJ:').sort((a, b) => b.y - a.y);
        if (!headers.length)
            throw new Error(`Página ${pageIndex + 1}: recibo sem CNPJ.`);
        for (const [index, header] of headers.entries()) {
            const items = page.filter(i => i.y <= header.y + 15 && i.y > (headers[index + 1]?.y ?? -100) + (headers[index + 1] ? 15 : 0) && i.x < 515);
            const lines: PositionedText[][] = [];
            for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
                const last = lines.at(-1);
                if (last && Math.abs(last[0]!.y - item.y) < 2)
                    last.push(item);
                else
                    lines.push([item]);
            }
            lines.forEach(l => l.sort((a, b) => a.x - b.x));
            const text = (line: PositionedText[]) => line.map(i => i.text).join(' ');
            const cnpj = items.find(i => /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(i.text))?.text.replace(/\D/g, '');
            const monthLine = lines.map(text).find(t => /\w+ de \d{4}$/.test(t));
            const match = monthLine?.toLowerCase().match(/(\S+) de (\d{4})$/);
            const month = match ? meses.indexOf(match[1]!) + 1 : 0;
            if (!cnpj || !month || !match)
                throw new Error(`Página ${pageIndex + 1}: competência ou CNPJ não reconhecido.`);
            const competencia = `${match[2]}-${String(month).padStart(2, '0')}`;
            const employee = lines.find(l => l[0]!.x < 65 && /^\d+$/.test(l[0]!.text) && l.some(i => i.x > 360 && /^\d{6}$/.test(i.text)));
            const table = items.find(i => i.text === 'Vencimentos');
            const totals = items.find(i => i.text === 'Total de Vencimentos');
            if (!employee || !table || !totals)
                throw new Error(`Página ${pageIndex + 1}: estrutura do recibo não reconhecida.`);
            const codColaborador = Number(employee[0]!.text);
            const nome = employee.filter(i => i.x > 65 && i.x < 360).map(i => i.text).join(' ');
            const below = (label: string, minX: number, maxX: number) => {
                const anchor = items.find(i => i.text === label);
                const value = anchor && items.filter(i => i.y < anchor.y - 2 && i.y > anchor.y - 23 && i.x >= minX && i.x < maxX && money.test(i.text)).sort((a, b) => b.y - a.y)[0];
                if (!value)
                    throw new Error(`Página ${pageIndex + 1}: valor de ${label} ausente.`);
                return numero(value.text);
            };
            let rubricas = lines.filter(l => l[0]!.y < table.y - 3 && l[0]!.y > totals.y && l[0]!.x < 65 && /^\d+$/.test(l[0]!.text)).map(l => {
                const value = l.find(i => i.x >= 360 && money.test(i.text));
                if (!value)
                    throw new Error(`Página ${pageIndex + 1}: rubrica sem valor.`);
                return { codColaborador, rubricaCodigo: Number(l[0]!.text), valor: numero(value.text), natureza: value.x >= 440 ? 'DESCONTO' as const : 'PROVENTO' as const, descricao: l.filter(i => i.x >= 65 && i.x < 280).map(i => i.text).join(' ') };
            });
            const key = `${cnpj}:${competencia}`;
            const identity = `${key}:${codColaborador}`;
            const parte = `${identity}:${JSON.stringify(items.map(i => i.text).sort())}`;
            if (partes.has(parte))
                continue;
            partes.add(parte);
            rubricas = [...(pendentes.get(identity) ?? []), ...rubricas];
            if (items.some(i => i.text === 'TRANSPORTAR')) {
                pendentes.set(identity, rubricas);
                continue;
            }
            pendentes.delete(identity);
            const proventos = below('Total de Vencimentos', 360, 440);
            const descontos = below('Total de Descontos', 440, 515);
            const netAnchor = items.find(i => i.text === 'Valor Líquido');
            const net = netAnchor && items.find(i => Math.abs(i.y - netAnchor.y) < 3 && i.x > 440 && money.test(i.text));
            if (!net)
                throw new Error(`Página ${pageIndex + 1}: líquido ausente.`);
            if (Math.abs(soma(rubricas.filter(r => r.natureza === 'PROVENTO').map(r => r.valor)) - proventos) > .011 || Math.abs(soma(rubricas.filter(r => r.natureza === 'DESCONTO').map(r => r.valor)) - descontos) > .011 || Math.abs(proventos - descontos - numero(net.text)) > .011)
                throw new Error(`Página ${pageIndex + 1}: totais do recibo não conferem.`);
            const adm = items.find(i => /\d{2}\/\d{2}\/\d{4}/.test(i.text))?.text;
            const colab = { codColaborador, nome, cpf: '', situacao: null, dataAdmissao: adm ? adm.split('/').reverse().join('-') : null, dataDemissao: null, motivoDemissao: null, vinculo: null, centroCusto: null, departamento: Number(employee.find(i => i.x > 420 && i.x < 470)?.text) || null, cargoCodigo: null, cargoNome: lines.find(l => l.some(i => i.x >= 80 && i.x < 360) && l[0]!.y < employee[0]!.y - 3 && l[0]!.y > table.y)?.filter(i => i.x >= 80 && i.x < 360).map(i => i.text).join(' ') ?? null, cbo: employee.find(i => i.x > 360 && /^\d{6}$/.test(i.text))?.text ?? null, salario: below('Salário Base', 35, 130), proventos, descontos, liquido: numero(net.text), baseInss: below('Sal. Contr. INSS', 130, 210), baseFgts: below('Base Cálc. FGTS', 210, 300), valorFgts: below('F.G.T.S do Mês', 300, 380), baseIrrf: below('Base Cálc. IRRF', 380, 450) };
            const signature = JSON.stringify({ colab, rubricas });
            if (vistos.has(identity)) {
                if (vistos.get(identity) !== signature)
                    throw new Error(`Recibos divergentes para matrícula ${codColaborador} em ${competencia}.`);
                continue;
            }
            vistos.set(identity, signature);
            let comp = competencias.get(key);
            if (!comp) {
                comp = { competencia, cnpj, codEmpresaDominio: '', razaoSocial: lines.find(l => l[0]!.y > header.y + 3) ? text(lines.find(l => l[0]!.y > header.y + 3)!) : null, colaboradores: [], linhasProvento: [], linhasDesconto: [], resumoRubricas: [], totalGeralProventos: 0, totalGeralDescontos: 0, liquidoGeral: 0, baseFgts: 0, valorFgts: 0, baseFgtsRescisorio: null, valorFgtsRescisorio: null, totalInss: null, inssEmpresa: null, rat: null, terceiros: null, noEmpregados: null, trabalhando: null, demitido: null, admissoes: null, noContribuintes: null };
                competencias.set(key, comp);
            }
            comp.colaboradores.push(colab);
            for (const r of rubricas) {
                (r.natureza === 'PROVENTO' ? comp.linhasProvento : comp.linhasDesconto).push({ codColaborador, rubricaCodigo: r.rubricaCodigo, valor: r.valor });
                const existing = comp.resumoRubricas.find(x => x.rubricaCodigo === r.rubricaCodigo && x.natureza === r.natureza);
                if (existing)
                    existing.valor = soma([existing.valor, r.valor]);
                else
                    comp.resumoRubricas.push({ rubricaCodigo: r.rubricaCodigo, rubricaDescricao: r.descricao, natureza: r.natureza, quantidadeTexto: null, valor: r.valor });
            }
            comp.totalGeralProventos = soma(comp.colaboradores.map(c => c.proventos));
            comp.totalGeralDescontos = soma(comp.colaboradores.map(c => c.descontos));
            comp.liquidoGeral = soma(comp.colaboradores.map(c => c.liquido));
            comp.baseFgts = soma(comp.colaboradores.map(c => c.baseFgts ?? 0));
            comp.valorFgts = soma(comp.colaboradores.map(c => c.valorFgts ?? 0));
            comp.noEmpregados = comp.colaboradores.length;
        }
    }
    if (pendentes.size)
        throw new Error('Recibo incompleto: falta a página de continuação.');
    return { arquivoOrigem, competencias: [...competencias.values()], avisos: ['Recibos não informam os encargos patronais (INSS empresa, RAT e terceiros).'] };
}
