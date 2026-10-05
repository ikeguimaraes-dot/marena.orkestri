-- Schema-only baseline. No source rows, users, documents or secrets.
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "mise";


ALTER SCHEMA "mise" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "opx";


ALTER SCHEMA "opx" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."checklist_area" AS ENUM (
    'cozinha',
    'bar',
    'salao',
    'higiene',
    'geral'
);


ALTER TYPE "public"."checklist_area" OWNER TO "postgres";


CREATE TYPE "public"."checklist_turno" AS ENUM (
    'abertura',
    'almoco',
    'jantar',
    'fechamento'
);


ALTER TYPE "public"."checklist_turno" OWNER TO "postgres";


CREATE TYPE "public"."conversation_status" AS ENUM (
    'ativa',
    'assumida',
    'encerrada'
);


ALTER TYPE "public"."conversation_status" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'rascunho',
    'pendente_aprovacao',
    'confirmado',
    'aprovado',
    'em_andamento',
    'concluido',
    'realizado',
    'cancelado'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."menu_item_category" AS ENUM (
    'bar',
    'cozinha',
    'bebida_alcoolica',
    'bebida_nao_alcoolica',
    'entrada',
    'prato_principal',
    'sobremesa',
    'outros'
);


ALTER TYPE "public"."menu_item_category" OWNER TO "postgres";


CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'rascunho',
    'enviado',
    'parcial',
    'recebido',
    'cancelado'
);


ALTER TYPE "public"."purchase_order_status" OWNER TO "postgres";


CREATE TYPE "public"."quote_status" AS ENUM (
    'rascunho',
    'enviada',
    'recebida',
    'aprovada',
    'cancelada'
);


ALTER TYPE "public"."quote_status" OWNER TO "postgres";


CREATE TYPE "public"."reservation_origem" AS ENUM (
    'whatsapp',
    'telefone',
    'email',
    'tagme',
    'presencial',
    'instagram'
);


ALTER TYPE "public"."reservation_origem" OWNER TO "postgres";


CREATE TYPE "public"."reservation_status" AS ENUM (
    'pendente',
    'confirmada',
    'cancelada',
    'no_show',
    'finalizada'
);


ALTER TYPE "public"."reservation_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "opx"."block_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'opx.% é append-only — % não é permitido (id=%)', TG_TABLE_NAME, TG_OP, coalesce(old.id, null);
end;
$$;


ALTER FUNCTION "opx"."block_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_sync_employee_tier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    NEW.tier := NULL;
  ELSE
    SELECT r.tier INTO NEW.tier FROM public.roles r WHERE r.id = NEW.role_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_sync_employee_tier"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_check"("p_identifier_hash" "text", "p_action" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.auth_rate_limits
    WHERE identifier_hash = p_identifier_hash
      AND action = p_action
      AND blocked_until > now()
  );
$$;


ALTER FUNCTION "public"."auth_rate_limit_check"("p_identifier_hash" "text", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_clear"("p_identifier_hash" "text", "p_action" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  DELETE FROM public.auth_rate_limits
  WHERE identifier_hash = p_identifier_hash AND action = p_action;
$$;


ALTER FUNCTION "public"."auth_rate_limit_clear"("p_identifier_hash" "text", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_rate_limit_fail"("p_identifier_hash" "text", "p_action" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.auth_rate_limits AS limits
    (identifier_hash, action, failures, window_started_at, blocked_until, updated_at)
  VALUES (p_identifier_hash, p_action, 1, now(), NULL, now())
  ON CONFLICT (identifier_hash, action) DO UPDATE SET
    failures = CASE
      WHEN limits.window_started_at <= now() - interval '15 minutes' THEN 1
      ELSE limits.failures + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - interval '15 minutes' THEN now()
      ELSE limits.window_started_at
    END,
    blocked_until = CASE
      WHEN (CASE WHEN limits.window_started_at <= now() - interval '15 minutes' THEN 1 ELSE limits.failures + 1 END) >= 5
      THEN now() + interval '15 minutes'
      ELSE limits.blocked_until
    END,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."auth_rate_limit_fail"("p_identifier_hash" "text", "p_action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_talentos"("p_statuses" "text"[], "p_termo" "text" DEFAULT NULL::"text", "p_cargo" "text" DEFAULT NULL::"text", "p_cidade" "text" DEFAULT NULL::"text", "p_escolaridade" "text" DEFAULT NULL::"text", "p_habilidade" "text" DEFAULT NULL::"text", "p_turno" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "full_name" "text", "area_interesse" "text", "cidade" "text", "escolaridade_nivel" "text", "habilidades" "text"[], "cv_storage_path" "text", "status" "text", "origem" "text", "created_at" timestamp with time zone, "total_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    c.id,
    c.full_name,
    c.area_interesse,
    c.cidade,
    c.escolaridade_nivel,
    c.habilidades,
    c.cv_storage_path,
    c.status::text,
    c.origem,
    c.created_at,
    COUNT(*) OVER ()::bigint AS total_count
  FROM candidates c
  WHERE c.status = ANY(p_statuses)
    AND (p_termo        IS NULL OR c.full_name       ILIKE '%' || p_termo        || '%')
    AND (p_cargo        IS NULL OR c.area_interesse  ILIKE '%' || p_cargo        || '%')
    AND (p_cidade       IS NULL OR c.cidade          ILIKE '%' || p_cidade       || '%')
    AND (p_escolaridade IS NULL OR c.escolaridade_nivel = p_escolaridade)
    AND (p_habilidade   IS NULL OR EXISTS (
           SELECT 1 FROM unnest(c.habilidades) h
           WHERE h ILIKE '%' || p_habilidade || '%'
         ))
    AND (p_turno        IS NULL OR EXISTS (
           SELECT 1 FROM unnest(c.turnos_disponiveis) t
           WHERE t ILIKE '%' || p_turno || '%'
         ))
  ORDER BY c.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."buscar_talentos"("p_statuses" "text"[], "p_termo" "text", "p_cargo" "text", "p_cidade" "text", "p_escolaridade" "text", "p_habilidade" "text", "p_turno" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_recipe_cost"("p_menu_item_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(SUM(custo_total), 0)
    FROM public.recipe_items
   WHERE menu_item_id = p_menu_item_id;
$$;


ALTER FUNCTION "public"."calculate_recipe_cost"("p_menu_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_primo_acesso"("p_cpf" "text") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'employee_id', e.id,
    'has_auth',    (SELECT EXISTS (SELECT 1 FROM employee_auth a WHERE a.cpf = p_cpf))
  )
  FROM employees e
  WHERE e.cpf = p_cpf
  LIMIT 1;
$$;


ALTER FUNCTION "public"."check_primo_acesso"("p_cpf" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_survey_response"("p_employee_id" "uuid", "p_survey_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM climate_responses WHERE employee_id = p_employee_id AND survey_id = p_survey_id);
END;
$$;


ALTER FUNCTION "public"."check_survey_response"("p_employee_id" "uuid", "p_survey_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_employee_auth"("p_employee_id" "uuid", "p_cpf" "text", "p_password_hash" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO employee_auth (employee_id, cpf, password_hash)
  VALUES (p_employee_id, p_cpf, p_password_hash);
$$;


ALTER FUNCTION "public"."create_employee_auth"("p_employee_id" "uuid", "p_cpf" "text", "p_password_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_punch_adjustment"("p_employee_id" "uuid", "p_data_referencia" "date", "p_horario_saida_almoco" time without time zone, "p_horario_retorno_almoco" time without time zone, "p_motivo" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_id     uuid;
  v_dow    int;
  v_today  date;
  v_mon    date;
  v_fri    date;
BEGIN
  -- Dia da semana em SP (0=dom, 1=seg … 6=sab)
  v_today := CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo';
  v_dow   := EXTRACT(DOW FROM v_today)::int;

  -- Início (segunda) e fim (sexta) da semana corrente em SP
  v_mon := v_today - ((v_dow + 6) % 7);
  v_fri := v_mon + 4;

  -- Validação: apenas dias úteis da semana corrente
  IF p_data_referencia < v_mon OR p_data_referencia > v_fri THEN
    RAISE EXCEPTION 'Ajuste permitido apenas para dias úteis da semana corrente (% a %)', v_mon, v_fri;
  END IF;

  -- Validação: sem solicitação pendente para o mesmo dia
  IF EXISTS (
    SELECT 1 FROM punch_adjustment_requests
    WHERE employee_id = p_employee_id
      AND data_referencia = p_data_referencia
      AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Já existe uma solicitação pendente para %', p_data_referencia;
  END IF;

  -- Validação: retorno após saída
  IF p_horario_retorno_almoco <= p_horario_saida_almoco THEN
    RAISE EXCEPTION 'Horário de retorno deve ser posterior à saída para almoço';
  END IF;

  INSERT INTO punch_adjustment_requests (
    employee_id, data_referencia,
    horario_saida_almoco, horario_retorno_almoco,
    motivo, status
  ) VALUES (
    p_employee_id, p_data_referencia,
    p_horario_saida_almoco, p_horario_retorno_almoco,
    p_motivo, 'pendente'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_punch_adjustment"("p_employee_id" "uuid", "p_data_referencia" "date", "p_horario_saida_almoco" time without time zone, "p_horario_retorno_almoco" time without time zone, "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."events_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."events_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_aplicar_lote"("p_operations" "jsonb", "p_expected" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
 op jsonb; row_data jsonb; scope jsonb; tbl text; kind text;
 cols text; conflict_cols text; update_cols text; statement text; n integer; actual_revision bigint; predicates text; allowed_columns text[];
 allowed text[] := ARRAY[
 'lancamentos','dre_snapshot','kpi_snapshot','metas','reconciliacoes_sugeridas','protestos_certidoes','protestos_registros',
 'titulos_a_pagar','produtos_relatorio','nfe_documentos','nfe_importacoes',
 'payroll_extrato_dominio_competencia','payroll_extrato_dominio_colaborador',
 'payroll_extrato_dominio_linha','payroll_extrato_dominio_rubrica',
 'receita_dias','receita_pagamentos','receita_ambientes','receita_turnos',
 'receita_grupos','receita_descontos','receita_descontos_detalhe',
 'receita_cancelamentos','receita_cancelamentos_detalhe','receita_horarios',
 'receita_usuarios','receita_produtos_dia','receita_caixas','financeiro_importacoes',
 'vendas_consolidado_periodo','vendas_consolidado_produtos','vendas_consolidado_resumo',
 'vendas_consolidado_funcionarios','vendas_consolidado_ambiente','vendas_consolidado_turno',
 'vendas_consolidado_dia_semana','vendas_consolidado_mensal'
 ];
BEGIN
 IF auth.uid() IS NULL AND current_user <> 'service_role' THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Lote inválido'; END IF;
 -- Serialize replacement commits (no delete/insert interleaving).
 PERFORM pg_advisory_xact_lock(hashtextextended('financeiro_importacao',0));
 IF p_expected IS NOT NULL THEN
  SELECT revisao INTO actual_revision FROM public.financeiro_revisoes WHERE unit_id=(p_expected->>'unit_id')::uuid FOR UPDATE;
  IF coalesce(actual_revision,0) <> (p_expected->>'revisao')::bigint THEN RAISE EXCEPTION 'As fontes mudaram durante o cálculo. Tente novamente.' USING ERRCODE='40001'; END IF;
 END IF;
 FOR op IN SELECT value FROM jsonb_array_elements(p_operations) LOOP
  tbl := op->>'table'; kind := op->>'operation';
  IF tbl IS NULL OR NOT tbl=ANY(allowed) THEN RAISE EXCEPTION 'Tabela não permitida'; END IF;
  SELECT array_agg(column_name::text) INTO allowed_columns FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl;
  IF kind='delete' THEN
   scope := op->'scope';
   IF scope IS NULL OR jsonb_typeof(scope)<>'object' OR scope='{}'::jsonb THEN RAISE EXCEPTION 'Exclusão sem escopo'; END IF;
   -- RLS may hide unauthorized rows; explicitly reject a denied unit so a
   -- replacement cannot silently succeed without replacing its old version.
   IF scope ? 'unit_id' AND current_user <> 'service_role' AND NOT public.financeiro_can_write((scope->>'unit_id')::uuid) THEN RAISE EXCEPTION 'Unidade não autorizada' USING ERRCODE='42501'; END IF;
   SELECT string_agg(CASE WHEN scope->key='null'::jsonb THEN format('t.%I IS NULL',key)
     ELSE format('t.%I = (jsonb_populate_record(NULL::public.%I,$1)).%I',key,tbl,key) END,' AND '),count(*)
     INTO predicates,n FROM jsonb_object_keys(scope) key WHERE key=ANY(allowed_columns);
   IF n<>(SELECT count(*) FROM jsonb_object_keys(scope)) THEN RAISE EXCEPTION 'Coluna de escopo inválida'; END IF;
   EXECUTE format('DELETE FROM public.%I t WHERE %s',tbl,predicates) USING scope;
  ELSIF kind IN ('insert','upsert') THEN
   IF jsonb_typeof(op->'rows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Linhas inválidas'; END IF;
   FOR row_data IN SELECT value FROM jsonb_array_elements(op->'rows') LOOP
    IF jsonb_typeof(row_data)<>'object' OR row_data='{}'::jsonb THEN RAISE EXCEPTION 'Linha inválida'; END IF;
    SELECT string_agg(format('%I',key),',' ORDER BY key), count(*) INTO cols,n
    FROM jsonb_object_keys(row_data) key WHERE key=ANY(allowed_columns);
    IF n<>(SELECT count(*) FROM jsonb_object_keys(row_data)) THEN RAISE EXCEPTION 'Coluna inválida em %',tbl; END IF;
    statement := format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1)',tbl,cols,cols,tbl);
    IF kind='upsert' THEN
     IF coalesce(op->>'conflict','')='' THEN RAISE EXCEPTION 'Chave de conflito obrigatória'; END IF;
     SELECT string_agg(format('%I',key),',') INTO conflict_cols FROM unnest(string_to_array(op->>'conflict',',')) key;
     SELECT string_agg(format('%I=EXCLUDED.%I',key,key),',') INTO update_cols FROM jsonb_object_keys(row_data) key WHERE NOT key=ANY(string_to_array(op->>'conflict',','));
     statement := statement || format(' ON CONFLICT (%s) ',conflict_cols) || CASE WHEN coalesce((op->>'ignoreDuplicates')::boolean,false) OR update_cols IS NULL THEN 'DO NOTHING' ELSE 'DO UPDATE SET ' || update_cols END;
    END IF;
    EXECUTE statement USING row_data;
   END LOOP;
  ELSE RAISE EXCEPTION 'Operação inválida'; END IF;
 END LOOP;
END $_$;


ALTER FUNCTION "public"."financeiro_aplicar_lote"("p_operations" "jsonb", "p_expected" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_can_read"("p_unit" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$ SELECT auth.uid() IS NOT NULL AND (public.kph_is_founder() OR (p_unit IS NOT NULL AND public.kph_has_role_for_unit(p_unit))) $$;


ALTER FUNCTION "public"."financeiro_can_read"("p_unit" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_can_write"("p_unit" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$ SELECT auth.uid() IS NOT NULL AND (public.kph_is_founder() OR EXISTS (
 SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
 WHERE ur.user_id=auth.uid() AND ur.unit_id=p_unit AND r.name <> 'socio_readonly'
)) $$;


ALTER FUNCTION "public"."financeiro_can_write"("p_unit" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_estornar_pagamento"("p_pagamento" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE p public.titulo_pagamentos;
BEGIN
 SELECT * INTO p FROM public.titulo_pagamentos WHERE id=p_pagamento FOR UPDATE;
 IF auth.uid() IS NULL OR p.id IS NULL OR NOT public.financeiro_can_write(p.unit_id) THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p.estornado_em IS NOT NULL THEN RETURN; END IF;
 UPDATE public.titulo_pagamentos SET estornado_em=now(),estornado_por=auth.uid() WHERE id=p.id;
 INSERT INTO public.movimentacoes_caixa(unit_id,conta_id,data,tipo,valor,descricao,origem,origem_id,conciliado)
 VALUES(p.unit_id,p.conta_id,CURRENT_DATE,'entrada',p.valor,'Estorno de pagamento registrado','manual','estorno:'||p.id::text,true);
END $$;


ALTER FUNCTION "public"."financeiro_estornar_pagamento"("p_pagamento" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_has_membership"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid()) $$;


ALTER FUNCTION "public"."financeiro_has_membership"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_importar_produtos"("p_rows" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE r jsonb; old_row jsonb; rid bigint; matches integer; saved integer:=0; seen bigint[]:=ARRAY[]::bigint[];
BEGIN
 IF auth.uid() IS NULL AND current_user <> 'service_role' THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 THEN RAISE EXCEPTION 'Importação vazia'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('financeiro_importacao',0));
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF r->>'unit_id' IS NULL OR (current_user<>'service_role' AND NOT public.financeiro_can_write((r->>'unit_id')::uuid)) THEN RAISE EXCEPTION 'Unidade não autorizada'; END IF;
  IF r->>'chave_nfe' IS NOT NULL OR nullif(r->>'nr_danfe','') IS NULL OR coalesce(nullif(r->>'fornecedor_codigo',''),nullif(r->>'fornecedor_nome','')) IS NULL OR coalesce(nullif(r->>'item_codigo',''),nullif(r->>'item_descricao','')) IS NULL THEN RAISE EXCEPTION 'Informe nota, fornecedor e item para identificar a linha da planilha.'; END IF;
  SELECT count(*),min(p.id) INTO matches,rid FROM public.produtos_relatorio p WHERE p.chave_nfe IS NULL AND p.unit_id=(r->>'unit_id')::uuid
   AND p.nr_danfe=r->>'nr_danfe' AND p.mes_lancamento=(r->>'mes_lancamento')::integer AND p.ano_lancamento=(r->>'ano_lancamento')::integer
   AND coalesce(nullif(p.fornecedor_codigo,''),upper(trim(p.fornecedor_nome)))=coalesce(nullif(r->>'fornecedor_codigo',''),upper(trim(r->>'fornecedor_nome')))
   AND coalesce(nullif(p.item_codigo,''),upper(trim(p.item_descricao)))=coalesce(nullif(r->>'item_codigo',''),upper(trim(r->>'item_descricao')));
  IF matches>1 THEN RAISE EXCEPTION 'Itens repetidos na nota %. Confira a identidade antes de importar.',r->>'nr_danfe'; END IF;
  r:=jsonb_strip_nulls(r)-'id';
  IF matches=1 THEN
   IF rid=ANY(seen) THEN RAISE EXCEPTION 'O arquivo repete o mesmo item da nota. Informe códigos distintos.'; END IF;
   SELECT to_jsonb(p) INTO old_row FROM public.produtos_relatorio p WHERE id=rid FOR UPDATE;
   r:=old_row||r;
   PERFORM public.financeiro_aplicar_lote(jsonb_build_array(jsonb_build_object('table','produtos_relatorio','operation','upsert','conflict','id','rows',jsonb_build_array(r))));
   seen:=array_append(seen,rid);
  ELSE
   PERFORM public.financeiro_aplicar_lote(jsonb_build_array(jsonb_build_object('table','produtos_relatorio','operation','insert','rows',jsonb_build_array(r))));
   SELECT id INTO rid FROM public.produtos_relatorio p WHERE p.chave_nfe IS NULL AND p.unit_id=(r->>'unit_id')::uuid AND p.nr_danfe=r->>'nr_danfe' AND p.mes_lancamento=(r->>'mes_lancamento')::integer AND p.ano_lancamento=(r->>'ano_lancamento')::integer
    AND coalesce(nullif(p.fornecedor_codigo,''),upper(trim(p.fornecedor_nome)))=coalesce(nullif(r->>'fornecedor_codigo',''),upper(trim(r->>'fornecedor_nome')))
    AND coalesce(nullif(p.item_codigo,''),upper(trim(p.item_descricao)))=coalesce(nullif(r->>'item_codigo',''),upper(trim(r->>'item_descricao')));
   seen:=array_append(seen,rid);
  END IF;
  saved:=saved+1;
 END LOOP;
 RETURN saved;
END $$;


ALTER FUNCTION "public"."financeiro_importar_produtos"("p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_importar_titulos"("p_rows" "jsonb", "p_operations" "jsonb" DEFAULT '[]'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE r jsonb; old_row jsonb; matches integer; saved integer:=0; rid text; seen text[]:=ARRAY[]::text[];
BEGIN
 IF auth.uid() IS NULL AND current_user <> 'service_role' THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 THEN RAISE EXCEPTION 'Importação vazia'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('financeiro_importacao',0));
 PERFORM public.financeiro_aplicar_lote(p_operations);
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF current_user <> 'service_role' AND (NOT public.financeiro_can_write((r->>'unit_id')::uuid) OR NOT public.financeiro_can_write((r->>'import_unit_id')::uuid)) THEN RAISE EXCEPTION 'Unidade não autorizada'; END IF;
  IF r->>'unit_id' IS NULL OR r->>'import_unit_id' IS NULL OR r->>'v_titulo' IS NULL OR r->>'origem' IS NULL OR (r->>'v_titulo')::numeric < 0 OR r->>'origem' NOT IN ('contas_pagar','nf_pedidos') THEN RAISE EXCEPTION 'Título inválido'; END IF;
  -- Explicit ERP identity first; spreadsheet identity otherwise. Value is NOT identity.
  SELECT count(*), min(t.id) INTO matches,rid FROM public.titulos_a_pagar t
   WHERE t.import_unit_id=(r->>'import_unit_id')::uuid AND t.origem=r->>'origem'
   AND ((r->>'id' IS NOT NULL AND t.id=r->>'id') OR
    (t.d_competencia=(r->>'d_competencia')::date
     AND upper(trim(coalesce(t.fantasia_fornecedor,t.razao_fornecedor,'')))=upper(trim(coalesce(r->>'fantasia_fornecedor',r->>'razao_fornecedor','')))
     AND coalesce(t.n_nota_fiscal,'')=coalesce(r->>'n_nota_fiscal','')
     AND coalesce(t.parcela,'')=coalesce(r->>'parcela','')
     AND (nullif(r->>'n_nota_fiscal','') IS NOT NULL OR
       (t.d_lancamento IS NOT DISTINCT FROM (r->>'d_lancamento')::date AND t.d_vencimento IS NOT DISTINCT FROM (r->>'d_vencimento')::date
        AND coalesce(t.c_gerencial,'')=coalesce(r->>'c_gerencial','')))));
  IF matches>1 THEN RAISE EXCEPTION 'Mais de um título corresponde a fornecedor %, nota %, parcela %. Confira a identidade antes de importar.',r->>'fantasia_fornecedor',r->>'n_nota_fiscal',r->>'parcela'; END IF;
  IF matches=1 THEN
   SELECT to_jsonb(t) INTO old_row FROM public.titulos_a_pagar t WHERE t.id=rid FOR UPDATE;
   IF EXISTS(SELECT 1 FROM public.titulo_pagamentos WHERE titulo_id=rid) THEN
    IF old_row->>'unit_id' <> r->>'unit_id' OR (r->>'v_titulo')::numeric < (SELECT coalesce(sum(valor),0) FROM public.titulo_pagamentos WHERE titulo_id=rid AND estornado_em IS NULL) THEN
     RAISE EXCEPTION 'Título com pagamento registrado: a importação não pode trocar a unidade nem reduzir o valor abaixo do pago.';
    END IF;
   END IF;
   -- Do not overwrite bank-confirmed payments or their audit trail from a spreadsheet.
   r := jsonb_strip_nulls(r) - 'id' - 'n_titulo' - 'v_pagamento' - 'd_liquidacao';
   r := old_row || r || jsonb_build_object('id',rid,'importado_em',now());
  ELSE
   rid:=coalesce(r->>'id',gen_random_uuid()::text);
   r:=jsonb_strip_nulls(r)||jsonb_build_object('id',rid,'n_titulo',coalesce(r->>'n_titulo',rid),'importado_em',now());
  END IF;
  IF rid=ANY(seen) THEN RAISE EXCEPTION 'Arquivo contém linhas com a mesma identidade de título. Informe a parcela ou desambigue as linhas.'; END IF;
  seen:=array_append(seen,rid);
  PERFORM public.financeiro_aplicar_lote(jsonb_build_array(jsonb_build_object('table','titulos_a_pagar','operation','upsert','conflict','id','rows',jsonb_build_array(r))));
  saved:=saved+1;
 END LOOP;
 RETURN saved;
END $$;


ALTER FUNCTION "public"."financeiro_importar_titulos"("p_rows" "jsonb", "p_operations" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_registrar_pagamento"("p_titulo" "text", "p_conta" "uuid", "p_data" "date", "p_valor" numeric, "p_comprovante" "text", "p_pedido" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE t public.titulos_a_pagar; pago numeric; pid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 SELECT * INTO t FROM public.titulos_a_pagar WHERE id=p_titulo FOR UPDATE;
 IF t.id IS NULL OR NOT public.financeiro_can_write(t.unit_id) OR t.origem<>'contas_pagar' THEN RAISE EXCEPTION 'Título não autorizado'; END IF;
 IF nullif(t.n_nota_fiscal,'') IS NOT NULL AND EXISTS(SELECT 1 FROM public.titulos_a_pagar d WHERE d.id<>t.id AND d.unit_id=t.unit_id AND d.origem=t.origem AND d.n_nota_fiscal=t.n_nota_fiscal AND upper(trim(coalesce(d.fantasia_fornecedor,d.razao_fornecedor,'')))=upper(trim(coalesce(t.fantasia_fornecedor,t.razao_fornecedor,''))) AND d.parcela IS NOT DISTINCT FROM t.parcela AND d.d_lancamento IS NOT DISTINCT FROM t.d_lancamento AND d.d_vencimento IS NOT DISTINCT FROM t.d_vencimento) THEN RAISE EXCEPTION 'Possível duplicidade de título. Confira a planilha antes de registrar o pagamento.'; END IF;
 SELECT id INTO pid FROM public.titulo_pagamentos WHERE pedido_id=p_pedido AND titulo_id=p_titulo;
 IF pid IS NOT NULL THEN RETURN pid; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.titulo_pagamentos WHERE titulo_id=p_titulo) AND (upper(trim(coalesce(t.liquidacao_origem,''))) LIKE 'OK%' OR upper(trim(coalesce(t.liquidacao_origem,'')))='OIK') THEN RAISE EXCEPTION 'Título já informado como pago pela planilha. Confira antes de registrar novo pagamento.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.contas_bancarias WHERE id=p_conta AND unit_id=t.unit_id AND ativo) THEN RAISE EXCEPTION 'Selecione uma conta ativa da unidade'; END IF;
 SELECT coalesce(sum(valor),0) INTO pago FROM public.titulo_pagamentos WHERE titulo_id=p_titulo AND estornado_em IS NULL;
 IF p_valor IS NULL OR p_valor<=0 OR round(p_valor,2)<>p_valor OR pago+p_valor>abs(t.v_titulo) THEN RAISE EXCEPTION 'Valor excede o saldo do título ou é inválido'; END IF;
 IF p_data IS NULL OR p_data>CURRENT_DATE OR nullif(trim(p_comprovante),'') IS NULL THEN RAISE EXCEPTION 'Informe data realizada e referência do comprovante'; END IF;
 INSERT INTO public.titulo_pagamentos(unit_id,titulo_id,conta_id,data,valor,comprovante,criado_por,pedido_id)
 VALUES(t.unit_id,p_titulo,p_conta,p_data,p_valor,p_comprovante,auth.uid(),p_pedido) RETURNING id INTO pid;
 INSERT INTO public.movimentacoes_caixa(unit_id,conta_id,data,tipo,valor,descricao,origem,origem_id,conciliado)
 VALUES(t.unit_id,p_conta,p_data,'saida',p_valor,'Pagamento registrado: '||p_comprovante,'manual','pagamento:'||pid::text,true);
 RETURN pid;
END $$;


ALTER FUNCTION "public"."financeiro_registrar_pagamento"("p_titulo" "text", "p_conta" "uuid", "p_data" "date", "p_valor" numeric, "p_comprovante" "text", "p_pedido" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_source_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE old_unit uuid; new_unit uuid; parent_id uuid;
BEGIN
 IF TG_TABLE_NAME IN ('regras_classificacao','produtos_depara','produtos_catalogo','fornecedores_depara','fornecedores','plano_contas') THEN
  INSERT INTO public.financeiro_revisoes(unit_id) SELECT id FROM public.units WHERE current_user='service_role' OR public.financeiro_can_write(id)
  ON CONFLICT(unit_id) DO UPDATE SET revisao=financeiro_revisoes.revisao+1;
  RETURN NULL;
 END IF;
 IF TG_TABLE_NAME='lancamentos' THEN
  IF TG_OP <> 'INSERT' AND OLD.origem IN ('manual','inventario') THEN old_unit:=OLD.unit_id; END IF;
  IF TG_OP <> 'DELETE' AND NEW.origem IN ('manual','inventario') THEN new_unit:=NEW.unit_id; END IF;
 ELSIF TG_TABLE_NAME='receita_cancelamentos' THEN
  IF TG_OP <> 'INSERT' THEN SELECT unit_id INTO old_unit FROM public.receita_dias WHERE id=OLD.workday_id_fk; END IF;
  IF TG_OP <> 'DELETE' THEN SELECT unit_id INTO new_unit FROM public.receita_dias WHERE id=NEW.workday_id_fk; END IF;
 ELSE
  IF TG_OP <> 'INSERT' THEN old_unit := OLD.unit_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_unit := NEW.unit_id; END IF;
 END IF;
 IF old_unit IS NOT NULL THEN INSERT INTO public.financeiro_revisoes(unit_id) VALUES(old_unit) ON CONFLICT(unit_id) DO UPDATE SET revisao=financeiro_revisoes.revisao+1; END IF;
 IF new_unit IS NOT NULL AND new_unit IS DISTINCT FROM old_unit THEN INSERT INTO public.financeiro_revisoes(unit_id) VALUES(new_unit) ON CONFLICT(unit_id) DO UPDATE SET revisao=financeiro_revisoes.revisao+1; END IF;
 RETURN NULL;
END $$;


ALTER FUNCTION "public"."financeiro_source_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."financeiro_storage_unit"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN split_part(p_name,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN NULL; END $$;


ALTER FUNCTION "public"."financeiro_storage_unit"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ingredient_price_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.custo_padrao IS DISTINCT FROM OLD.custo_padrao THEN
    INSERT INTO ingredient_price_history (ingredient_id, custo_anterior, custo_novo, motivo)
    VALUES (NEW.id, OLD.custo_padrao, NEW.custo_padrao, 'alteracao_manual');

    UPDATE public.recipe_items
       SET custo_unitario = NEW.custo_padrao
     WHERE ingredient_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_ingredient_price_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_oa_set_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."fn_oa_set_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_menu_item_custo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  target_menu_id UUID;
BEGIN
  target_menu_id := COALESCE(NEW.menu_item_id, OLD.menu_item_id);

  UPDATE public.menu_items
     SET custo_total = COALESCE(
           (SELECT SUM(custo_total) FROM public.recipe_items WHERE menu_item_id = target_menu_id),
           0
         ),
         tem_ficha_tecnica = EXISTS (
           SELECT 1 FROM public.recipe_items WHERE menu_item_id = target_menu_id
         ),
         updated_at = NOW()
   WHERE id = target_menu_id;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."fn_recalc_menu_item_custo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_status_prazo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare v_dias integer;
begin
  if new.status = 'congelada' then
    new.status_prazo := 'congelada';
  elsif new.status = 'fechada' then
    new.status_prazo := 'no_prazo';
  elsif new.sla_dias is not null then
    v_dias := (current_date - new.created_at::date);
    new.status_prazo := case
      when v_dias <= new.sla_dias * 0.6 then 'no_prazo'
      when v_dias <= new.sla_dias       then 'atencao'
      else                                   'atrasado'
    end;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_recalc_status_prazo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sync_qtd_alvo"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.cargo_id IS NOT NULL THEN
    NEW.qtd_alvo :=
      COALESCE(NEW.alvo_manha,         0)
    + COALESCE(NEW.alvo_tarde,         0)
    + COALESCE(NEW.alvo_noite,         0)
    + COALESCE(NEW.alvo_madrugada,     0)
    + COALESCE(NEW.alvo_intermediario, 0);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_sync_qtd_alvo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."folha_empresa_competencias"("p_unit_id" "uuid") RETURNS TABLE("competencia" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT f.competencia FROM public.folha_empresa f WHERE f.unit_id=p_unit_id ORDER BY f.competencia DESC;
$$;


ALTER FUNCTION "public"."folha_empresa_competencias"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_campaigns"() RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(c ORDER BY c.created_at DESC), '[]'::json)
  FROM campaigns c
  WHERE c.active = true;
$$;


ALTER FUNCTION "public"."get_active_campaigns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_survey"("p_unit_id" "uuid") RETURNS TABLE("survey_id" "uuid", "titulo" "text", "descricao" "text", "tipo" "text", "questions" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.titulo, s.descricao, s.tipo,
    (SELECT jsonb_agg(jsonb_build_object('id',q.id,'ordem',q.ordem,'texto',q.texto,'tipo',q.tipo) ORDER BY q.ordem)
     FROM climate_questions q WHERE q.survey_id = s.id) as questions
  FROM climate_surveys s
  WHERE (s.unit_id = p_unit_id OR s.unit_id IS NULL)
    AND s.status = 'ativa'
  ORDER BY s.publicado_em DESC LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_active_survey"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_by_cpf"("p_cpf" "text") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT row_to_json(a)
  FROM (
    SELECT id, cpf, password_hash, employee_id
    FROM employee_auth
    WHERE cpf = p_cpf
    LIMIT 1
  ) a;
$$;


ALTER FUNCTION "public"."get_auth_by_cpf"("p_cpf" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."candidate_avaliacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "aderencia_skills" numeric(3,1),
    "experiencia" numeric(3,1),
    "entrevista_tec" numeric(3,1),
    "entrevista_comp" numeric(3,1),
    "aderencia_ia_sugerida" boolean DEFAULT false,
    "experiencia_ia_sugerida" boolean DEFAULT false,
    "nota_final" numeric(3,1) GENERATED ALWAYS AS (((((COALESCE("aderencia_skills", (0)::numeric) + COALESCE("experiencia", (0)::numeric)) + COALESCE("entrevista_tec", (0)::numeric)) + COALESCE("entrevista_comp", (0)::numeric)) / (4)::numeric)) STORED,
    "avaliador_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidate_avaliacao_aderencia_skills_check" CHECK ((("aderencia_skills" >= (0)::numeric) AND ("aderencia_skills" <= (10)::numeric))),
    CONSTRAINT "candidate_avaliacao_entrevista_comp_check" CHECK ((("entrevista_comp" >= (0)::numeric) AND ("entrevista_comp" <= (10)::numeric))),
    CONSTRAINT "candidate_avaliacao_entrevista_tec_check" CHECK ((("entrevista_tec" >= (0)::numeric) AND ("entrevista_tec" <= (10)::numeric))),
    CONSTRAINT "candidate_avaliacao_experiencia_check" CHECK ((("experiencia" >= (0)::numeric) AND ("experiencia" <= (10)::numeric)))
);


ALTER TABLE "public"."candidate_avaliacao" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_avaliacao"("p_candidate_id" "uuid") RETURNS "public"."candidate_avaliacao"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT * FROM public.candidate_avaliacao WHERE candidate_id = p_candidate_id;
$$;


ALTER FUNCTION "public"."get_avaliacao"("p_candidate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cargo_salarios"() RETURNS TABLE("id" "uuid", "cargo_id" "uuid", "cargo_nome" "text", "setor" "text", "grupo" "text", "tem_nivel" boolean, "nivel" integer, "unit_id" "uuid", "salario_min" numeric, "salario_ref" numeric, "salario_max" numeric, "observacao" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select cs.id, cs.cargo_id, c.nome, c.setor, c.grupo,
         c.tem_nivel, cs.nivel, cs.unit_id,
         cs.salario_min, cs.salario_ref, cs.salario_max, cs.observacao
  from cargo_salarios cs
  join cargos c on c.id = cs.cargo_id
  where c.ativo = true
  order by c.setor, c.nome, cs.nivel nulls first;
$$;


ALTER FUNCTION "public"."get_cargo_salarios"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cargos"() RETURNS TABLE("id" "uuid", "nome" "text", "setor" "text", "grupo" "text", "tem_nivel" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, nome, setor, grupo, tem_nivel
  FROM   public.cargos
  WHERE  ativo = true
  ORDER  BY setor, nome;
$$;


ALTER FUNCTION "public"."get_cargos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_profile"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT row_to_json(e)
  FROM (
    SELECT id, nome, sobrenome, cpf, departamento, funcao,
           email, data_admissao, ativo, status_rh, photo_url, unit_id
    FROM employees
    WHERE id = p_employee_id
    LIMIT 1
  ) e;
$$;


ALTER FUNCTION "public"."get_employee_profile"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_feedback_operacional" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "agendamento_id" "uuid",
    "postura_apresentacao" numeric(3,1),
    "ritmo_sob_pressao" numeric(3,1),
    "dominio_tecnico" numeric(3,1),
    "higiene_seguranca" numeric(3,1),
    "trabalho_em_equipe" numeric(3,1),
    "nota_final" numeric(4,2) GENERATED ALWAYS AS ((((((COALESCE("postura_apresentacao", (0)::numeric) + COALESCE("ritmo_sob_pressao", (0)::numeric)) + COALESCE("dominio_tecnico", (0)::numeric)) + COALESCE("higiene_seguranca", (0)::numeric)) + COALESCE("trabalho_em_equipe", (0)::numeric)) / 5.0)) STORED,
    "parecer" "text",
    "avaliador_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."candidate_feedback_operacional" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feedback_operacional"("p_candidate_id" "uuid") RETURNS "public"."candidate_feedback_operacional"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.candidate_feedback_operacional
  WHERE candidate_id = p_candidate_id;
$$;


ALTER FUNCTION "public"."get_feedback_operacional"("p_candidate_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_gap_headcount"("p_unit_id" "uuid") RETURNS TABLE("departamento" "text", "cargo" "text", "grupo" "text", "qtd_alvo" integer, "headcount_atual" integer, "gap" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    qi.departamento,
    qi.cargo,
    cg.nome                                     AS grupo,
    qi.qtd_alvo,
    COALESCE(hc.n, 0)::integer                  AS headcount_atual,
    (qi.qtd_alvo - COALESCE(hc.n, 0))::integer  AS gap
  FROM public.quadro_ideal qi
  JOIN public.cargo_grupos cg ON cg.id = qi.cargo_grupo_id
  LEFT JOIN (
    SELECT
      unaccent(lower(trim(e.funcao))) AS cargo_norm,
      COUNT(*)::integer               AS n
    FROM public.employees e
    WHERE e.unit_id = p_unit_id
      AND e.ativo   = true
    GROUP BY unaccent(lower(trim(e.funcao)))
  ) hc ON hc.cargo_norm = unaccent(lower(trim(qi.cargo)))
  WHERE qi.unit_id    = p_unit_id
    AND qi.vigente_ate IS NULL
  ORDER BY qi.departamento, qi.cargo;
$$;


ALTER FUNCTION "public"."get_gap_headcount"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_adjustment_requests"("p_employee_id" "uuid") RETURNS TABLE("id" "uuid", "data_referencia" "date", "horario_saida_almoco" "text", "horario_retorno_almoco" "text", "motivo" "text", "status" "text", "created_at" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.data_referencia,
    TO_CHAR(r.horario_saida_almoco, 'HH24:MI')   AS horario_saida_almoco,
    TO_CHAR(r.horario_retorno_almoco, 'HH24:MI') AS horario_retorno_almoco,
    r.motivo,
    r.status,
    TO_CHAR(r.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
  FROM punch_adjustment_requests r
  WHERE r.employee_id = p_employee_id
  ORDER BY r.created_at DESC
  LIMIT 30;
END;
$$;


ALTER FUNCTION "public"."get_my_adjustment_requests"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_dept"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT r.dept
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_dept"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_development"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'pdis', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',          p.id,
            'titulo',      p.titulo,
            'data_inicio', p.data_inicio,
            'data_fim',    p.data_fim,
            'status',      p.status,
            'created_at',  p.created_at,
            'pdi_metas', (
              SELECT COALESCE(json_agg(m), '[]'::json)
              FROM pdi_metas m WHERE m.pdi_id = p.id
            )
          )
          ORDER BY p.created_at DESC
        ),
        '[]'::json
      )
      FROM pdis p WHERE p.employee_id = p_employee_id
    ),
    'feedbacks', (
      SELECT COALESCE(json_agg(f ORDER BY f.created_at DESC), '[]'::json)
      FROM feedbacks f WHERE f.para_employee_id = p_employee_id
    ),
    'trainings', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',         tp.id,
            'status',     tp.status,
            'nota',       tp.nota,
            'created_at', tp.created_at,
            'trainings', (
              SELECT row_to_json(t) FROM trainings t WHERE t.id = tp.training_id
            )
          )
          ORDER BY tp.created_at DESC
        ),
        '[]'::json
      )
      FROM training_participants tp WHERE tp.employee_id = p_employee_id
    ),
    'action_plans', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',         ap.id,
            'titulo',     ap.titulo,
            'origem',     ap.origem,
            'prazo',      ap.prazo,
            'status',     ap.status,
            'created_at', ap.created_at,
            'action_plan_tasks', (
              SELECT COALESCE(json_agg(apt), '[]'::json)
              FROM action_plan_tasks apt WHERE apt.plan_id = ap.id
            )
          )
          ORDER BY ap.created_at DESC
        ),
        '[]'::json
      )
      FROM action_plans ap WHERE ap.employee_id = p_employee_id
    )
  );
$$;


ALTER FUNCTION "public"."get_my_development"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_documents"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(d ORDER BY d.uploaded_at DESC NULLS LAST), '[]'::json)
  FROM documents d
  WHERE d.employee_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_documents"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_gorjetas"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(g ORDER BY g.ano DESC, g.mes DESC), '[]'::json)
  FROM gorjeta_distribuicao g
  WHERE g.employee_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_gorjetas"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_home"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'score', (
      SELECT score FROM employees WHERE id = p_employee_id
    ),
    'photo_url', (
      SELECT photo_url FROM employees WHERE id = p_employee_id
    ),
    'banco_horas', (
      SELECT row_to_json(t)
      FROM (
        SELECT saldo_banco, banco_horas_acumulado
        FROM time_records
        WHERE employee_id = p_employee_id
        ORDER BY periodo DESC
        LIMIT 1
      ) t
    ),
    'faltas_mes', (
      SELECT COUNT(*)
      FROM absences
      WHERE employee_id = p_employee_id
        AND data >= DATE_TRUNC('month', CURRENT_DATE)::date
    ),
    'last_punch', (
      SELECT row_to_json(p)
      FROM (
        SELECT tipo, timestamp_punch
        FROM time_clock_punches
        WHERE employee_id = p_employee_id
          AND timestamp_punch >= CURRENT_DATE::timestamptz
        ORDER BY timestamp_punch DESC
        LIMIT 1
      ) p
    ),
    'last_campanha', (
      SELECT row_to_json(c)
      FROM (
        SELECT title, category
        FROM campaigns
        WHERE active = true
        ORDER BY created_at DESC
        LIMIT 1
      ) c
    ),
    'podium', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',        e.id,
            'nome',      e.nome,
            'sobrenome', e.sobrenome,
            'photo_url', e.photo_url,
            'score',     e.score
          )
          ORDER BY e.score DESC
        ),
        '[]'::json
      )
      FROM (
        SELECT id, nome, sobrenome, photo_url, score
        FROM employees
        WHERE score IS NOT NULL
        ORDER BY score DESC
        LIMIT 10
      ) e
    )
  );
$$;


ALTER FUNCTION "public"."get_my_home"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_hour_bank"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(h ORDER BY h.competencia DESC), '[]'::json)
  FROM hour_bank h
  WHERE h.employee_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_hour_bank"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_last_punch"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT row_to_json(p)
  FROM (
    SELECT tipo, timestamp_punch
    FROM time_clock_punches
    WHERE employee_id = p_employee_id
      AND timestamp_punch >= CURRENT_DATE::timestamptz
    ORDER BY timestamp_punch DESC
    LIMIT 1
  ) p;
$$;


ALTER FUNCTION "public"."get_my_last_punch"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_level"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT r.level
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_payments"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(c ORDER BY c.competencia DESC), '[]'::json)
  FROM contractor_payments c
  WHERE c.contractor_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_payments"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_payslips"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(json_agg(p ORDER BY p.competencia DESC), '[]'::json)
  FROM payslips p
  WHERE p.employee_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_payslips"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_punch_history"("p_employee_id" "uuid", "p_days" integer DEFAULT 30) RETURNS TABLE("dia" "date", "punches" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(timestamp_punch AT TIME ZONE 'America/Sao_Paulo') as dia,
    jsonb_agg(
      jsonb_build_object(
        'tipo', tipo,
        'horario', TO_CHAR(
          timestamp_punch AT TIME ZONE 'America/Sao_Paulo',
          'HH24:MI'
        )
      ) ORDER BY timestamp_punch ASC
    ) as punches
  FROM time_clock_punches
  WHERE
    employee_id = p_employee_id
    AND DATE(timestamp_punch AT TIME ZONE 'America/Sao_Paulo')
        < CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo'
    AND DATE(timestamp_punch AT TIME ZONE 'America/Sao_Paulo')
        >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo') - p_days
  GROUP BY dia
  ORDER BY dia DESC;
END;
$$;


ALTER FUNCTION "public"."get_my_punch_history"("p_employee_id" "uuid", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_punches_today"("p_employee_id" "uuid") RETURNS TABLE("id" "uuid", "tipo" "text", "timestamp_punch" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, tipo, timestamp_punch
  FROM time_clock_punches
  WHERE employee_id = p_employee_id
    AND (timestamp_punch AT TIME ZONE 'America/Sao_Paulo')::date =
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY timestamp_punch ASC;
$$;


ALTER FUNCTION "public"."get_my_punches_today"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_registro"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'time_records', (
      SELECT COALESCE(json_agg(t ORDER BY t.periodo DESC), '[]'::json)
      FROM time_records t
      WHERE t.employee_id = p_employee_id
    ),
    'overtime', (
      SELECT COALESCE(json_agg(o ORDER BY o.date DESC), '[]'::json)
      FROM overtime_records o
      WHERE o.employee_id = p_employee_id
    ),
    'absences', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',           a.id,
            'date',         a.data,
            'type',         a.tipo,
            'reason',       a.motivo,
            'score_impact', a.score_impact,
            'atestado_path',a.atestado_path
          )
          ORDER BY a.data DESC
        ),
        '[]'::json
      )
      FROM absences a
      WHERE a.employee_id = p_employee_id
    ),
    'warnings', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',            w.id,
            'date',          w.data,
            'level',         w.nivel,
            'description',   w.descricao,
            'score_impact',  w.score_impact,
            'documento_path',w.documento_path
          )
          ORDER BY w.data DESC
        ),
        '[]'::json
      )
      FROM warnings w
      WHERE w.employee_id = p_employee_id
    ),
    'tips', (
      SELECT COALESCE(json_agg(tp ORDER BY tp.periodo DESC), '[]'::json)
      FROM tips_records tp
      WHERE tp.employee_id = p_employee_id
    ),
    'transport', (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id',                  tv.id,
            'periodo',             tv.periodo,
            'dias_uteis',          tv.dias_uteis,
            'valor_diario',        tv.valor_diario,
            'desconto_funcionario',tv.desconto_funcionario,
            'valor_empresa',       tv.total_bruto
          )
          ORDER BY tv.periodo DESC
        ),
        '[]'::json
      )
      FROM transport_vouchers tv
      WHERE tv.employee_id = p_employee_id
    )
  );
$$;


ALTER FUNCTION "public"."get_my_registro"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT r.name
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_sector"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT r.sector
  FROM public.employees e
  JOIN public.roles r ON r.id = e.role_id
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_sector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_tier"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT CASE
    WHEN e.tier IN ('T5', 'T6') THEN 'T4'
    ELSE e.tier
  END
  FROM public.employees e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_tier"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_tier"() IS 'Retorna tier RLS normalizado: T5/T6 → T4 (backward compat). Use get_my_tier_real() para o valor real.';



CREATE OR REPLACE FUNCTION "public"."get_my_tier_real"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT e.tier
  FROM public.employees e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_tier_real"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_my_tier_real"() IS 'Retorna o tier real do colaborador sem normalização (T1..T6).';



CREATE OR REPLACE FUNCTION "public"."get_my_unit"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT e.unit_id
  FROM public.employees e
  WHERE e.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_my_unit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_vacations"("p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id',                       v.id,
        'periodo_aquisitivo_inicio', v.acquisitive_period_start,
        'periodo_aquisitivo_fim',    v.acquisitive_period_end,
        'inicio_gozo',               v.start_date,
        'fim_gozo',                  v.end_date,
        'dias_direito',              v.days_entitled,
        'dias_gozados',              v.days_taken,
        'dias_vendidos',             v.abono_days,
        'status',                    v.status
      )
      ORDER BY v.acquisitive_period_start DESC NULLS LAST
    ),
    '[]'::json
  )
  FROM vacations v
  WHERE v.employee_id = p_employee_id;
$$;


ALTER FUNCTION "public"."get_my_vacations"("p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organograma"() RETURNS TABLE("id" "uuid", "nome" "text", "setor" "text", "grupo" "text", "reporta_a_cargo_id" "uuid", "ordem_hierarquia" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id, nome, setor, grupo, reporta_a_cargo_id, ordem_hierarquia
  FROM public.cargos
  WHERE ativo = true
    AND setor <> 'Estoque'
  ORDER BY ordem_hierarquia NULLS FIRST, nome;
$$;


ALTER FUNCTION "public"."get_organograma"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_produto_meses"("p_unit_id" "uuid") RETURNS TABLE("mes" integer, "ano" integer, "total" bigint)
    LANGUAGE "sql"
    AS $$
  SELECT mes_lancamento, ano_lancamento, COUNT(*) as total
  FROM produtos_relatorio
  WHERE unit_id = p_unit_id
  GROUP BY mes_lancamento, ano_lancamento
  ORDER BY ano_lancamento, mes_lancamento;
$$;


ALTER FUNCTION "public"."get_produto_meses"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_punches_by_unit"("p_unit_id" "uuid", "p_date" "date") RETURNS TABLE("employee_id" "uuid", "nome_completo" "text", "funcao" "text", "unit_id" "uuid", "tipo" "text", "registrado_em" timestamp with time zone, "gps_failed" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id,
    (e.nome || ' ' || e.sobrenome)::text,
    e.funcao::text,
    e.unit_id,
    tcp.tipo::text,
    tcp.timestamp_punch,
    (tcp.latitude IS NULL AND tcp.longitude IS NULL)::boolean
  FROM employees e
  LEFT JOIN time_clock_punches tcp
    ON  tcp.employee_id = e.id
    -- Filtro por data no fuso SP — não UTC
    AND DATE(tcp.timestamp_punch AT TIME ZONE 'America/Sao_Paulo') = p_date
  WHERE
    e.ativo IS NOT FALSE
    AND (
      -- T6 sentinel: todas as unidades
      p_unit_id = '00000000-0000-0000-0000-000000000010'::uuid
      -- unidade específica solicitada
      OR e.unit_id = p_unit_id
      -- colaboradores HOS (nível holding) sempre incluídos
      OR e.unit_id = '00000000-0000-0000-0000-000000000010'::uuid
    )
  ORDER BY e.nome, e.sobrenome, tcp.timestamp_punch NULLS LAST;
$$;


ALTER FUNCTION "public"."get_punches_by_unit"("p_unit_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_quadro_completo"("p_unit_id" "uuid") RETURNS TABLE("id" "uuid", "cargo_id" "uuid", "cargo_nome" "text", "setor" "text", "grupo" "text", "tem_nivel" boolean, "alvo_manha" integer, "alvo_tarde" integer, "alvo_noite" integer, "alvo_madrugada" integer, "alvo_intermediario" integer, "qtd_alvo" integer, "headcount_atual" integer, "gap" integer, "reporta_a_cargo_id" "uuid", "reporta_a_nome" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    qi.id,
    qi.cargo_id,
    c.nome                                                   AS cargo_nome,
    c.setor,
    c.grupo,
    c.tem_nivel,
    qi.alvo_manha,
    qi.alvo_tarde,
    qi.alvo_noite,
    qi.alvo_madrugada,
    qi.alvo_intermediario,
    COALESCE(qi.qtd_alvo, 0)                                 AS qtd_alvo,
    COALESCE(hc.n, 0)::integer                               AS headcount_atual,
    (COALESCE(qi.qtd_alvo,0) - COALESCE(hc.n,0))::integer   AS gap,
    qi.reporta_a_cargo_id,
    sup.nome                                                 AS reporta_a_nome
  FROM public.quadro_ideal qi
  JOIN public.cargos c ON c.id = qi.cargo_id
  LEFT JOIN public.cargos sup ON sup.id = qi.reporta_a_cargo_id
  LEFT JOIN (
    SELECT
      unaccent(lower(trim(e.funcao))) AS cargo_norm,
      COUNT(*)::integer               AS n
    FROM public.employees e
    WHERE e.unit_id = p_unit_id
      AND e.ativo   = true
    GROUP BY unaccent(lower(trim(e.funcao)))
  ) hc ON hc.cargo_norm = unaccent(lower(trim(c.nome)))
  WHERE qi.unit_id    = p_unit_id
    AND qi.vigente_ate IS NULL
    AND qi.cargo_id   IS NOT NULL
  ORDER BY c.setor, c.nome;
$$;


ALTER FUNCTION "public"."get_quadro_completo"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_quadro_ideal"("p_unit_id" "uuid") RETURNS TABLE("id" "uuid", "unit_id" "uuid", "departamento" "text", "cargo" "text", "cargo_grupo_nome" "text", "qtd_alvo" integer, "vigente_desde" "date", "vigente_ate" "date")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    qi.id,
    qi.unit_id,
    qi.departamento,
    qi.cargo,
    cg.nome        AS cargo_grupo_nome,
    qi.qtd_alvo,
    qi.vigente_desde,
    qi.vigente_ate
  FROM public.quadro_ideal qi
  JOIN public.cargo_grupos  cg ON cg.id = qi.cargo_grupo_id
  WHERE qi.unit_id    = p_unit_id
    AND qi.vigente_ate IS NULL
  ORDER BY qi.departamento, qi.cargo;
$$;


ALTER FUNCTION "public"."get_quadro_ideal"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_survey_results"("p_survey_id" "uuid") RETURNS TABLE("question_id" "uuid", "texto_pergunta" "text", "total_respostas" integer, "media_escala" numeric, "distribuicao" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.texto, COUNT(r.id)::int,
    ROUND(AVG(r.valor_escala), 1),
    jsonb_build_object('1',COUNT(r.id) FILTER (WHERE r.valor_escala=1),'2',COUNT(r.id) FILTER (WHERE r.valor_escala=2),'3',COUNT(r.id) FILTER (WHERE r.valor_escala=3),'4',COUNT(r.id) FILTER (WHERE r.valor_escala=4),'5',COUNT(r.id) FILTER (WHERE r.valor_escala=5))
  FROM climate_questions q LEFT JOIN climate_responses r ON r.question_id = q.id
  WHERE q.survey_id = p_survey_id GROUP BY q.id, q.texto ORDER BY q.ordem;
END;
$$;


ALTER FUNCTION "public"."get_survey_results"("p_survey_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unit_geofence"("p_unit_id" "uuid") RETURNS TABLE("latitude" double precision, "longitude" double precision, "radius_meters" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.latitude::double precision,
    u.longitude::double precision,
    u.geofence_radius_m AS radius_meters
  FROM units u
  WHERE u.id = p_unit_id;
END;
$$;


ALTER FUNCTION "public"."get_unit_geofence"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unit_surveys"("p_unit_id" "uuid", "p_employee_id" "uuid") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id',          s.id,
        'titulo',      s.titulo,
        'descricao',   s.descricao,
        'prazo',       s.data_fim,
        'status',      s.status,
        'unit_id',     s.unit_id,
        'already_answered', (
          SELECT EXISTS (
            SELECT 1 FROM climate_survey_responses r
            WHERE r.survey_id = s.id
              AND r.employee_id = p_employee_id
          )
        ),
        'questions', (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id',     q.id,
                'texto',  q.pergunta,
                'tipo',   q.tipo,
                'opcoes', q.opcoes,
                'ordem',  q.ordem
              )
              ORDER BY q.ordem
            ),
            '[]'::json
          )
          FROM climate_survey_questions q WHERE q.survey_id = s.id
        )
      )
      ORDER BY s.created_at DESC
    ),
    '[]'::json
  )
  FROM climate_surveys s
  WHERE s.unit_id = p_unit_id
    AND s.status = 'ativo';
$$;


ALTER FUNCTION "public"."get_unit_surveys"("p_unit_id" "uuid", "p_employee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."importar_folha_empresa"("p_linhas" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE quantidade integer;
BEGIN
  IF jsonb_typeof(p_linhas) <> 'array' OR jsonb_array_length(p_linhas) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Lote da folha inválido';
  END IF;
  INSERT INTO public.folha_empresa AS atual
    (unit_id,competencia,etapa,nome_chave,nome,pagamento,bonificacao,fontes,arquivo,documento_path)
  SELECT unit_id,competencia,etapa,nome_chave,nome,pagamento,bonificacao,coalesce(fontes,'{}'::jsonb),arquivo,documento_path
    FROM jsonb_to_recordset(p_linhas) AS r(unit_id uuid,competencia text,etapa text,nome_chave text,nome text,
      pagamento numeric,bonificacao numeric,fontes jsonb,arquivo text,documento_path text)
  ON CONFLICT (unit_id,competencia,etapa,nome_chave) DO UPDATE SET
    nome=excluded.nome,
    pagamento=coalesce(excluded.pagamento,atual.pagamento),
    bonificacao=coalesce(excluded.bonificacao,atual.bonificacao),
    fontes=atual.fontes || excluded.fontes,
    arquivo=excluded.arquivo,
    documento_path=coalesce(excluded.documento_path,atual.documento_path),
    atualizado_em=now();
  GET DIAGNOSTICS quantidade = ROW_COUNT;
  RETURN quantidade;
END $$;


ALTER FUNCTION "public"."importar_folha_empresa"("p_linhas" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_document"("p_employee_id" "uuid", "p_unit_id" "uuid", "p_name" "text", "p_type" "text", "p_storage_path" "text") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO documents (employee_id, unit_id, name, type, storage_path)
  VALUES (p_employee_id, p_unit_id, p_name, p_type, p_storage_path)
  RETURNING json_build_object('id', id, 'storage_path', storage_path);
$$;


ALTER FUNCTION "public"."insert_document"("p_employee_id" "uuid", "p_unit_id" "uuid", "p_name" "text", "p_type" "text", "p_storage_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text") RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  INSERT INTO time_clock_punches
    (employee_id, tipo, timestamp_punch, latitude, longitude, device_info)
  VALUES
    (p_employee_id, p_tipo, p_timestamp, p_latitude, p_longitude, p_device_info)
  RETURNING json_build_object(
    'id',              id,
    'tipo',            tipo,
    'timestamp_punch', timestamp_punch
  );
$$;


ALTER FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text", "p_aprovado" boolean DEFAULT true, "p_distance_meters" integer DEFAULT NULL::integer, "p_gps_failed" boolean DEFAULT false) RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  INSERT INTO time_clock_punches
    (employee_id, tipo, timestamp_punch, latitude, longitude, device_info,
     aprovado, distance_meters, gps_failed)
  VALUES
    (p_employee_id, p_tipo, p_timestamp, p_latitude, p_longitude, p_device_info,
     p_aprovado, p_distance_meters, p_gps_failed)
  RETURNING json_build_object(
    'id',              id,
    'tipo',            tipo,
    'timestamp_punch', timestamp_punch,
    'aprovado',        aprovado,
    'distance_meters', distance_meters
  );
$$;


ALTER FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text", "p_aprovado" boolean, "p_distance_meters" integer, "p_gps_failed" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_accessible_unit_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- Founder vê tudo
  SELECT id FROM units WHERE public.kph_is_founder()
  UNION
  -- Unit-scoped roles
  SELECT ur.unit_id
  FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.unit_id IS NOT NULL
  UNION
  -- Brand-scoped roles: todas as units da brand
  SELECT u.id
  FROM units u
  JOIN user_roles ur ON ur.brand_id = u.brand_id
  WHERE ur.user_id = auth.uid()
    AND ur.brand_id IS NOT NULL;
$$;


ALTER FUNCTION "public"."kph_accessible_unit_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_can_delete_event_brand"("p_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('founder','cfo')
          AND (
            ur.brand_id = p_brand_id
            OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id)
            OR ur.group_id IN (SELECT group_id FROM brands WHERE id = p_brand_id)
          )
      );
$$;


ALTER FUNCTION "public"."kph_can_delete_event_brand"("p_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_can_write_event_brand"("p_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('founder','cfo','gm','comercial','operacional')
          AND (
            ur.brand_id = p_brand_id
            OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id)
            OR ur.group_id IN (SELECT group_id FROM brands WHERE id = p_brand_id)
          )
      );
$$;


ALTER FUNCTION "public"."kph_can_write_event_brand"("p_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_has_role_for_brand"("p_brand_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.brand_id = p_brand_id
               OR ur.unit_id IN (SELECT id FROM units WHERE brand_id = p_brand_id))
      );
$$;


ALTER FUNCTION "public"."kph_has_role_for_brand"("p_brand_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_has_role_for_group"("p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.group_id = p_group_id
               OR ur.brand_id IN (SELECT id FROM brands WHERE group_id = p_group_id))
      );
$$;


ALTER FUNCTION "public"."kph_has_role_for_group"("p_group_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_has_role_for_unit"("p_unit_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.kph_is_founder()
      OR EXISTS (
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.unit_id = p_unit_id
      );
$$;


ALTER FUNCTION "public"."kph_has_role_for_unit"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_is_founder"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'founder'
  );
$$;


ALTER FUNCTION "public"."kph_is_founder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kph_is_founder_or_cfo"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name IN ('founder', 'cfo')
  );
$$;


ALTER FUNCTION "public"."kph_is_founder_or_cfo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maza_is_founder"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
    WHERE ur.user_id=auth.uid() AND r.name='founder'
  );
$$;


ALTER FUNCTION "public"."maza_is_founder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."norm_fone_br"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) IN (12, 13)
         AND regexp_replace(coalesce(p, ''), '\D', '', 'g') LIKE '55%'
    THEN substring(regexp_replace(p, '\D', '', 'g') FROM 3)
    ELSE regexp_replace(coalesce(p, ''), '\D', '', 'g')
  END;
$$;


ALTER FUNCTION "public"."norm_fone_br"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE
    -- regra por cargo tem precedência (ESTOQUE não existe como departamento)
    WHEN upper(unaccent(coalesce(p_cargo,''))) LIKE '%ESTOQUISTA%' THEN 'ESTOQUE'
    ELSE
      CASE upper(btrim(unaccent(coalesce(p_departamento,''))))
        WHEN 'SALAO'          THEN 'SALAO'
        WHEN 'COZINHA'        THEN 'COZINHA'
        WHEN 'BAR'            THEN 'BAR'
        WHEN 'ESTOQUE'        THEN 'ESTOQUE'
        WHEN 'ADM'            THEN 'ADM'
        WHEN 'ADMINISTRATIVO' THEN 'ADM'
        WHEN 'DIRETORIA'      THEN 'ADM'
        WHEN 'COMPRAS'        THEN 'ADM'
        WHEN 'LIMPEZA'        THEN 'SALAO'
        ELSE ''   -- GERAL, 'Departamento', vazio: a classificar
      END
  END;
$$;


ALTER FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") IS 'Normaliza centro de custo interno para o vocabulário do FOPAG (SALAO/COZINHA/BAR/ESTOQUE/ADM). Regra por cargo (Estoquista) tem precedência.';



CREATE OR REPLACE FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") RETURNS TABLE("mes" integer, "ano" integer)
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_mes_txt text := lower(split_part(p_competencia, '/', 1));
  v_ano_txt text := split_part(p_competencia, '/', 2);
BEGIN
  mes := CASE v_mes_txt
    WHEN 'jan' THEN 1  WHEN 'fev' THEN 2  WHEN 'mar' THEN 3
    WHEN 'abr' THEN 4  WHEN 'mai' THEN 5  WHEN 'jun' THEN 6
    WHEN 'jul' THEN 7  WHEN 'ago' THEN 8  WHEN 'set' THEN 9
    WHEN 'out' THEN 10 WHEN 'nov' THEN 11 WHEN 'dez' THEN 12
    ELSE NULL END;
  ano := CASE
    WHEN length(v_ano_txt) = 2 THEN 2000 + v_ano_txt::int
    ELSE v_ano_txt::int END;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") IS 'Converte competencia texto (jan/26) em mes/ano int para casar com gorjeta_distribuicao.';



CREATE OR REPLACE FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE WHEN v IS NULL THEN NULL
    ELSE replace(to_char(round((extract(epoch FROM v)/3600.0)::numeric, 2), 'FM9999990.00'), '.', ',')
  END;
$$;


ALTER FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) IS 'Converte interval em horas decimais com virgula (55:12 -> 55,20). Regra de importacao do Dominio.';



CREATE OR REPLACE FUNCTION "public"."payroll_num_to_br"("v" numeric) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT CASE WHEN v IS NULL THEN NULL
    ELSE replace(to_char(round(v, 2), 'FM9999999990.00'), '.', ',')
  END;
$$;


ALTER FUNCTION "public"."payroll_num_to_br"("v" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."payroll_parse_hhmm"("v" "text") RETURNS interval
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  SELECT
    CASE
      WHEN v IS NULL OR btrim(v) IN ('','00:00','00:00:00','0') THEN NULL
      WHEN v ~ '^\d+:\d{2}(:\d{2})?$' THEN
        make_interval(
          hours => split_part(v, ':', 1)::int,
          mins  => split_part(v, ':', 2)::int
        )
      ELSE NULL
    END;
$_$;


ALTER FUNCTION "public"."payroll_parse_hhmm"("v" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."payroll_parse_hhmm"("v" "text") IS 'Converte texto h:mm (ou hh:mm:ss) do ponto_mensal em interval. Retorna NULL para vazio/zero.';



CREATE OR REPLACE FUNCTION "public"."recalc_purchase_order_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE purchase_orders
     SET valor_total = COALESCE((
           SELECT SUM(total) FROM purchase_order_items WHERE order_id = v_order_id
         ), 0)
   WHERE id = v_order_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."recalc_purchase_order_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_punch_adjustment"("p_request_id" "uuid", "p_aprovado_por" "uuid", "p_status" "text", "p_inserir_punches" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_req punch_adjustment_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req
  FROM punch_adjustment_requests
  WHERE id = p_request_id AND status = 'pendente'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação % não encontrada ou já resolvida', p_request_id;
  END IF;

  UPDATE punch_adjustment_requests
  SET
    status      = p_status,
    aprovado_por = p_aprovado_por,
    aprovado_em  = now()
  WHERE id = p_request_id;

  -- Insere pontos retroativos apenas se aprovado e solicitado
  IF p_status = 'aprovado' AND p_inserir_punches THEN
    INSERT INTO time_clock_punches (employee_id, tipo, timestamp_punch, aprovado)
    VALUES
      -- Saída para almoço: data_referencia + horario_saida_almoco em SP → UTC
      (
        v_req.employee_id,
        'intervalo_inicio',
        (v_req.data_referencia::text || ' ' || v_req.horario_saida_almoco::text)::timestamp
          AT TIME ZONE 'America/Sao_Paulo',
        true
      ),
      -- Retorno do almoço
      (
        v_req.employee_id,
        'intervalo_fim',
        (v_req.data_referencia::text || ' ' || v_req.horario_retorno_almoco::text)::timestamp
          AT TIME ZONE 'America/Sao_Paulo',
        true
      );
  END IF;
END;
$$;


ALTER FUNCTION "public"."resolve_punch_adjustment"("p_request_id" "uuid", "p_aprovado_por" "uuid", "p_status" "text", "p_inserir_punches" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_coletar_periodo"("p_unit_id" "uuid", "p_competencia" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_periodo_id uuid;
  v_colabs     int := 0;
  v_linhas     int := 0;
  v_mes        int;
  v_ano        int;
  v_afast_genuino int;

  rid_pv01 uuid; rid_pv04 uuid; rid_pv05 uuid; rid_ds03 uuid; rid_ds04 uuid;
  rid_pv07 uuid; rid_in02 uuid; rid_in05 uuid; rid_in07 uuid; rid_in08 uuid;

  r record;
BEGIN
  SELECT mes, ano INTO v_mes, v_ano FROM payroll_competencia_mes_ano(p_competencia);

  SELECT id INTO rid_pv01 FROM payroll_rubricas WHERE cod_kph = 'PV-01';
  SELECT id INTO rid_pv04 FROM payroll_rubricas WHERE cod_kph = 'PV-04';
  SELECT id INTO rid_pv05 FROM payroll_rubricas WHERE cod_kph = 'PV-05';
  SELECT id INTO rid_ds03 FROM payroll_rubricas WHERE cod_kph = 'DS-03';
  SELECT id INTO rid_ds04 FROM payroll_rubricas WHERE cod_kph = 'DS-04';
  SELECT id INTO rid_pv07 FROM payroll_rubricas WHERE cod_kph = 'PV-07';
  SELECT id INTO rid_in02 FROM payroll_rubricas WHERE cod_kph = 'IN-02';
  SELECT id INTO rid_in05 FROM payroll_rubricas WHERE cod_kph = 'IN-05';
  SELECT id INTO rid_in07 FROM payroll_rubricas WHERE cod_kph = 'IN-07';
  SELECT id INTO rid_in08 FROM payroll_rubricas WHERE cod_kph = 'IN-08';

  INSERT INTO payroll_fechamento_periodo (unit_id, competencia, tipo_processo, status)
  VALUES (p_unit_id, p_competencia, '11', 'ABERTO')
  ON CONFLICT (unit_id, competencia, tipo_processo) DO UPDATE
    SET status = payroll_fechamento_periodo.status
  RETURNING id INTO v_periodo_id;

  FOR r IN
    SELECT pm.employee_id, ecd.cod_folha,
           pm.horas_trabalhadas, pm.horas_positivas, pm.banco_horas_mes,
           pm.adicional_noturno, pm.falta_injustificada_horas,
           pm.falta_injustificada_dias, pm.afastamentos_dias, pm.ferias_dias
    FROM ponto_mensal pm
    LEFT JOIN employee_codigos_dominio ecd
           ON ecd.employee_id = pm.employee_id AND ecd.unit_id = pm.unit_id
    WHERE pm.unit_id = p_unit_id AND pm.periodo = p_competencia
      AND pm.employee_id IS NOT NULL
  LOOP
    v_colabs := v_colabs + 1;

    IF payroll_parse_hhmm(r.adicional_noturno) IS NOT NULL THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor_horas,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_pv04,payroll_parse_hhmm(r.adicional_noturno),'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor_horas=EXCLUDED.valor_horas;
      v_linhas := v_linhas + 1;
    END IF;

    IF payroll_parse_hhmm(r.horas_positivas) IS NOT NULL THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor_horas,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_pv05,payroll_parse_hhmm(r.horas_positivas),'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor_horas=EXCLUDED.valor_horas;
      v_linhas := v_linhas + 1;
    END IF;

    IF payroll_parse_hhmm(r.falta_injustificada_horas) IS NOT NULL THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor_horas,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_ds03,payroll_parse_hhmm(r.falta_injustificada_horas),'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor_horas=EXCLUDED.valor_horas;
      v_linhas := v_linhas + 1;
    END IF;

    IF COALESCE(r.falta_injustificada_dias,0) > 0 THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_ds04,r.falta_injustificada_dias,'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor=EXCLUDED.valor;
      v_linhas := v_linhas + 1;
    END IF;

    IF payroll_parse_hhmm(r.horas_trabalhadas) IS NOT NULL THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor_horas,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_in02,payroll_parse_hhmm(r.horas_trabalhadas),'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor_horas=EXCLUDED.valor_horas;
      v_linhas := v_linhas + 1;
    END IF;

    IF payroll_parse_hhmm(r.banco_horas_mes) IS NOT NULL THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor_horas,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_in05,payroll_parse_hhmm(r.banco_horas_mes),'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor_horas=EXCLUDED.valor_horas;
      v_linhas := v_linhas + 1;
    END IF;

    v_afast_genuino := GREATEST(COALESCE(r.afastamentos_dias,0) - COALESCE(r.ferias_dias,0), 0);
    IF v_afast_genuino > 0 THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor,origem_lancamento,observacao)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_in07,v_afast_genuino,'AUTO',
              'afastamento genuino = afastamentos_dias - ferias_dias')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE
        SET valor = EXCLUDED.valor, observacao = EXCLUDED.observacao;
      v_linhas := v_linhas + 1;
    ELSE
      DELETE FROM payroll_fechamento_linha
      WHERE periodo_id = v_periodo_id AND employee_id = r.employee_id AND rubrica_id = rid_in07;
    END IF;

    IF COALESCE(r.ferias_dias,0) > 0 THEN
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_in08,r.ferias_dias,'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor=EXCLUDED.valor;
      v_linhas := v_linhas + 1;
    END IF;
  END LOOP;

  BEGIN
    FOR r IN
      SELECT DISTINCT pfl.employee_id, pfl.cod_folha, e.salario_base
      FROM payroll_fechamento_linha pfl
      JOIN employees e ON e.id = pfl.employee_id
      WHERE pfl.periodo_id = v_periodo_id
        AND e.salario_base IS NOT NULL AND e.salario_base > 0
    LOOP
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor,origem_lancamento)
      VALUES (v_periodo_id, r.employee_id, r.cod_folha, rid_pv01, r.salario_base, 'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor=EXCLUDED.valor;
      v_linhas := v_linhas + 1;
    END LOOP;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  BEGIN
    FOR r IN
      SELECT gd.employee_id, ecd.cod_folha, gd.valor_bruto
      FROM gorjeta_distribuicao gd
      LEFT JOIN employee_codigos_dominio ecd
             ON ecd.employee_id = gd.employee_id AND ecd.unit_id = gd.unit_id
      WHERE gd.unit_id = p_unit_id AND gd.mes = v_mes AND gd.ano = v_ano
        AND gd.valor_bruto > 0
    LOOP
      INSERT INTO payroll_fechamento_linha (periodo_id,employee_id,cod_folha,rubrica_id,valor,origem_lancamento)
      VALUES (v_periodo_id,r.employee_id,r.cod_folha,rid_pv07,r.valor_bruto,'AUTO')
      ON CONFLICT (periodo_id,employee_id,rubrica_id) DO UPDATE SET valor=EXCLUDED.valor;
      v_linhas := v_linhas + 1;
    END LOOP;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  DELETE FROM payroll_fechamento_linha pfl
  WHERE pfl.periodo_id = v_periodo_id AND pfl.rubrica_id = rid_pv07
    AND NOT EXISTS (
      SELECT 1 FROM gorjeta_distribuicao gd
      WHERE gd.employee_id = pfl.employee_id AND gd.unit_id = p_unit_id
        AND gd.mes = v_mes AND gd.ano = v_ano AND gd.valor_bruto > 0);

  UPDATE payroll_fechamento_periodo
  SET custo_total_folha = (
    SELECT COALESCE(SUM(pfl.valor),0)
    FROM payroll_fechamento_linha pfl
    JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
    WHERE pfl.periodo_id = v_periodo_id
      AND pr.tipo='PROVENTO' AND pr.unidade='R$' AND pfl.valor IS NOT NULL)
  WHERE id = v_periodo_id;

  RETURN jsonb_build_object(
    'ok', true, 'periodo_id', v_periodo_id,
    'unit_id', p_unit_id, 'competencia', p_competencia,
    'mes', v_mes, 'ano', v_ano,
    'colabs', v_colabs, 'linhas', v_linhas
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$_$;


ALTER FUNCTION "public"."rpc_payroll_coletar_periodo"("p_unit_id" "uuid", "p_competencia" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") RETURNS TABLE("employee_id" "uuid", "cod_folha" "text", "regime" "text", "cc" "text", "nome" "text", "cargo" "text", "admissao" "text", "salario" numeric, "gorjeta_1q" numeric, "gorjeta_2q" numeric, "gorjeta_compulsoria" numeric, "adicional_noturno" "text", "bonus" numeric, "quitacao_bh" numeric, "feriado" numeric, "emprestimo" numeric, "falta" numeric, "dsr" numeric, "plano_dependente" numeric, "coopart_plano" numeric, "desconto_vt" "text", "liquido" numeric, "total_liquido" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_unit_id     uuid;
  v_competencia text;
  v_mes         int;
  v_ano         int;
BEGIN
  SELECT p.unit_id, p.competencia INTO v_unit_id, v_competencia
  FROM payroll_fechamento_periodo p WHERE p.id = p_periodo_id;

  SELECT m.mes, m.ano INTO v_mes, v_ano
  FROM payroll_competencia_mes_ano(v_competencia) m;

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT pfl.employee_id AS eid, pfl.cod_folha AS cf
    FROM payroll_fechamento_linha pfl
    WHERE pfl.periodo_id = p_periodo_id
  ),
  ident AS (
    SELECT b.eid, b.cf,
           btrim(COALESCE(e.nome,'') || ' ' || COALESCE(e.sobrenome,'')) AS v_nome,
           COALESCE(NULLIF(btrim(pm.cargo),''), NULLIF(btrim(gd.cargo),''), '') AS v_cargo,
           COALESCE(NULLIF(btrim(pm.departamento),''), NULLIF(btrim(e.departamento),''), '') AS v_dep_raw,
           COALESCE(NULLIF(btrim(pm.data_admissao),''), NULLIF(btrim(e.data_admissao::text),''), '') AS v_admissao
    FROM base b
    LEFT JOIN employees e ON e.id = b.eid
    LEFT JOIN LATERAL (
      SELECT p2.cargo, p2.departamento, p2.data_admissao
      FROM ponto_mensal p2
      WHERE p2.employee_id = b.eid AND p2.unit_id = v_unit_id
      ORDER BY (p2.periodo = v_competencia) DESC, p2.created_at DESC
      LIMIT 1
    ) pm ON true
    LEFT JOIN LATERAL (
      SELECT g2.cargo
      FROM gorjeta_distribuicao g2
      WHERE g2.employee_id = b.eid AND g2.unit_id = v_unit_id
      ORDER BY (g2.mes = v_mes AND g2.ano = v_ano) DESC, g2.created_at DESC
      LIMIT 1
    ) gd ON true
  ),
  piv AS (
    SELECT pfl.employee_id AS eid,
      MAX(CASE WHEN pr.cod_kph='PV-01'  THEN pfl.valor END) AS p_salario,
      MAX(CASE WHEN pr.cod_kph='PV-07A' THEN pfl.valor END) AS p_g1,
      MAX(CASE WHEN pr.cod_kph='PV-07B' THEN pfl.valor END) AS p_g2,
      MAX(CASE WHEN pr.cod_kph='PV-07'  THEN pfl.valor END) AS p_gmes,
      MAX(CASE WHEN pr.cod_kph='PV-04'  THEN
            lpad((extract(epoch FROM pfl.valor_horas)/3600)::int::text,2,'0') || ':' ||
            lpad(mod((extract(epoch FROM pfl.valor_horas)/60)::int,60)::text,2,'0')
          END)                                              AS p_adnot,
      MAX(CASE WHEN pr.cod_kph='PV-15'  THEN pfl.valor END) AS p_bonus,
      MAX(CASE WHEN pr.cod_kph='PV-12'  THEN pfl.valor END) AS p_quitbh,
      MAX(CASE WHEN pr.cod_kph='PV-11'  THEN pfl.valor END) AS p_feriado,
      MAX(CASE WHEN pr.cod_kph='DS-10'  THEN pfl.valor END) AS p_emprestimo,
      MAX(CASE WHEN pr.cod_kph='DS-04'  THEN pfl.valor END) AS p_falta,
      MAX(CASE WHEN pr.cod_kph='DS-13'  THEN pfl.valor END) AS p_dsr,
      MAX(CASE WHEN pr.cod_kph='DS-05'  THEN pfl.valor END) AS p_planodep,
      MAX(CASE WHEN pr.cod_kph='DS-09'  THEN pfl.valor END) AS p_coopart,
      MAX(CASE WHEN pr.cod_kph='DS-06'  THEN pfl.observacao END) AS p_vt,
      MAX(CASE WHEN pr.cod_kph='RT-01'  THEN pfl.valor END) AS p_liquido,
      MAX(CASE WHEN pr.cod_kph='RT-02'  THEN pfl.valor END) AS p_totliq
    FROM payroll_fechamento_linha pfl
    JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
    WHERE pfl.periodo_id = p_periodo_id
    GROUP BY pfl.employee_id
  )
  SELECT
    i.eid,
    i.cf,
    'CLT'::text,
    payroll_cc_fopag(i.v_dep_raw, i.v_cargo)::text,   -- CC normalizado p/ FOPAG
    i.v_nome,
    i.v_cargo::text,
    i.v_admissao::text,
    pv.p_salario,
    pv.p_g1,
    pv.p_g2,
    COALESCE(pv.p_g1,0) + COALESCE(pv.p_g2,0)
      + CASE WHEN pv.p_g1 IS NULL AND pv.p_g2 IS NULL
             THEN COALESCE(pv.p_gmes,0) ELSE 0 END,
    pv.p_adnot,
    pv.p_bonus,
    pv.p_quitbh,
    pv.p_feriado,
    pv.p_emprestimo,
    pv.p_falta,
    pv.p_dsr,
    pv.p_planodep,
    pv.p_coopart,
    pv.p_vt,
    pv.p_liquido,
    pv.p_totliq
  FROM ident i
  LEFT JOIN piv pv ON pv.eid = i.eid
  ORDER BY i.v_nome;
END;
$$;


ALTER FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") IS 'Espelho da planilha FOPAG: pivota payroll_fechamento_linha nas 21 colunas que a contabilidade recebe hoje.';



CREATE OR REPLACE FUNCTION "public"."rpc_payroll_gerar_txt_dominio"("p_periodo_id" "uuid", "p_cod_empresa" "text" DEFAULT '567'::"text", "p_tipo_registro" "text" DEFAULT '10'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_competencia   text;
  v_tipo_processo text;
  v_mes int; v_ano int;
  v_txt          text := '';
  v_linhas       int := 0;
  v_excl_rubrica int := 0;
  v_excl_colab   int := 0;
  v_excl_zero    int := 0;
  v_total        numeric := 0;
  r record;
  v_valor_txt text;
BEGIN
  SELECT p.competencia, p.tipo_processo INTO v_competencia, v_tipo_processo
  FROM payroll_fechamento_periodo p WHERE p.id = p_periodo_id;

  IF v_competencia IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Periodo inexistente');
  END IF;

  SELECT m.mes, m.ano INTO v_mes, v_ano
  FROM payroll_competencia_mes_ano(v_competencia) m;

  FOR r IN
    SELECT pfl.employee_id,
           pfl.cod_folha,
           pr.cod_kph,
           pr.cod_dominio,
           pr.unidade,
           pfl.valor,
           pfl.valor_horas,
           btrim(COALESCE(e.nome,'')||' '||COALESCE(e.sobrenome,'')) AS nome
    FROM payroll_fechamento_linha pfl
    JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
    JOIN employees e ON e.id = pfl.employee_id
    WHERE pfl.periodo_id = p_periodo_id
      AND pr.tipo IN ('PROVENTO','DESCONTO')   -- informativas/base nao vao no TXT
    ORDER BY pfl.cod_folha::text, pr.cod_dominio
  LOOP
    -- exclusoes (contadas, nao silenciosas)
    IF r.cod_dominio IS NULL THEN
      v_excl_rubrica := v_excl_rubrica + 1; CONTINUE;
    END IF;
    IF r.cod_folha IS NULL OR btrim(r.cod_folha) = '' THEN
      v_excl_colab := v_excl_colab + 1; CONTINUE;
    END IF;

    -- valor: R$ ou horas decimais
    IF r.unidade = 'HORAS' AND r.valor_horas IS NOT NULL THEN
      v_valor_txt := payroll_interval_to_decimal_br(r.valor_horas);
    ELSIF r.valor IS NOT NULL THEN
      v_valor_txt := payroll_num_to_br(r.valor);
    ELSE
      v_valor_txt := NULL;
    END IF;

    IF v_valor_txt IS NULL OR v_valor_txt IN ('0,00','0,0000') THEN
      v_excl_zero := v_excl_zero + 1; CONTINUE;
    END IF;

    -- monta a linha (zero-padded, sem ':' nem '.')
    v_txt := v_txt
      || p_tipo_registro
      || lpad(regexp_replace(r.cod_folha,'[^0-9]','','g'), 10, '0')
      || lpad(v_ano::text, 4, '0')
      || lpad(v_mes::text, 2, '0')
      || lpad(regexp_replace(r.cod_dominio,'[^0-9]','','g'), 4, '0')
      || lpad(COALESCE(v_tipo_processo,'11'), 2, '0')
      || lpad(v_valor_txt, 10, '0')
      || lpad(regexp_replace(p_cod_empresa,'[^0-9]','','g'), 10, '0')
      || E'\n';

    v_linhas := v_linhas + 1;
    IF r.unidade <> 'HORAS' AND r.valor IS NOT NULL THEN
      v_total := v_total + r.valor;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'periodo_id', p_periodo_id,
    'competencia', v_competencia,
    'cod_empresa', p_cod_empresa,
    'tipo_processo', v_tipo_processo,
    'linhas_exportadas', v_linhas,
    'valor_total_rs', v_total,
    'excluidos_sem_cod_rubrica', v_excl_rubrica,
    'excluidos_sem_cod_colaborador', v_excl_colab,
    'excluidos_valor_zero', v_excl_zero,
    'txt', v_txt
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$_$;


ALTER FUNCTION "public"."rpc_payroll_gerar_txt_dominio"("p_periodo_id" "uuid", "p_cod_empresa" "text", "p_tipo_registro" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_listar_fechamento"("p_periodo_id" "uuid") RETURNS TABLE("employee_id" "uuid", "nome" "text", "cod_folha" "text", "cod_kph" "text", "descricao_rubrica" "text", "grupo" "text", "tipo_rubrica" "text", "valor" numeric, "valor_horas" "text", "origem_lancamento" "text", "unidade_rubrica" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pfl.employee_id,
    btrim(COALESCE(e.nome,'') || ' ' || COALESCE(e.sobrenome,'')) AS nome,
    pfl.cod_folha, pr.cod_kph, pr.descricao, pr.grupo, pr.tipo, pfl.valor,
    CASE WHEN pfl.valor_horas IS NOT NULL THEN
      lpad((extract(epoch FROM pfl.valor_horas)/3600)::int::text,2,'0') || ':' ||
      lpad((mod((extract(epoch FROM pfl.valor_horas)/60)::int,60))::text,2,'0')
    ELSE NULL END,
    pfl.origem_lancamento, pr.unidade
  FROM payroll_fechamento_linha pfl
  JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
  JOIN employees        e  ON e.id  = pfl.employee_id
  WHERE pfl.periodo_id = p_periodo_id
  ORDER BY 2, pr.grupo, pr.cod_kph;
END;
$$;


ALTER FUNCTION "public"."rpc_payroll_listar_fechamento"("p_periodo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_listar_periodos"("p_unit_id" "uuid") RETURNS TABLE("periodo_id" "uuid", "competencia" "text", "status" "text", "custo_total_folha" numeric, "colabs" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.id,
         p.competencia,
         p.status,
         p.custo_total_folha,
         (SELECT count(DISTINCT employee_id) FROM payroll_fechamento_linha WHERE periodo_id = p.id)
  FROM payroll_fechamento_periodo p
  WHERE p.unit_id = p_unit_id
  ORDER BY p.gerado_em DESC;
$$;


ALTER FUNCTION "public"."rpc_payroll_listar_periodos"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_txt_pendencias"("p_periodo_id" "uuid") RETURNS TABLE("motivo" "text", "nome" "text", "cod_folha" "text", "cod_kph" "text", "descricao" "text", "valor" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    CASE
      WHEN pfl.cod_folha IS NULL OR btrim(pfl.cod_folha)='' THEN 'SEM CODIGO DE COLABORADOR'
      WHEN pr.cod_dominio IS NULL THEN 'SEM CODIGO DE RUBRICA NO DOMINIO'
    END,
    btrim(COALESCE(e.nome,'')||' '||COALESCE(e.sobrenome,'')),
    pfl.cod_folha, pr.cod_kph, pr.descricao, pfl.valor
  FROM payroll_fechamento_linha pfl
  JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
  JOIN employees e ON e.id = pfl.employee_id
  WHERE pfl.periodo_id = p_periodo_id
    AND pr.tipo IN ('PROVENTO','DESCONTO')
    AND pr.cod_kph NOT IN ('PV-07A','PV-07B')   -- controle interno, nunca vai ao TXT
    AND (pfl.cod_folha IS NULL OR btrim(pfl.cod_folha)='' OR pr.cod_dominio IS NULL)
  ORDER BY 1, 2, 4;
$$;


ALTER FUNCTION "public"."rpc_payroll_txt_pendencias"("p_periodo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_payroll_upsert_lancamento_manual"("p_periodo_id" "uuid", "p_employee_id" "uuid", "p_cod_kph" "text", "p_valor" numeric DEFAULT NULL::numeric, "p_valor_horas" "text" DEFAULT NULL::"text", "p_observacao" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_rubrica_id uuid;
  v_cod_folha  text;
  v_status     text;
BEGIN
  SELECT status INTO v_status FROM payroll_fechamento_periodo WHERE id = p_periodo_id;
  IF v_status IN ('APROVADO','FECHADO') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Periodo ' || v_status || ' nao permite edicao');
  END IF;

  SELECT id INTO v_rubrica_id FROM payroll_rubricas WHERE cod_kph = p_cod_kph;
  IF v_rubrica_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Rubrica ' || p_cod_kph || ' inexistente');
  END IF;

  SELECT ecd.cod_folha INTO v_cod_folha
  FROM employee_codigos_dominio ecd
  JOIN payroll_fechamento_periodo p ON p.id = p_periodo_id
  WHERE ecd.employee_id = p_employee_id AND ecd.unit_id = p.unit_id;

  INSERT INTO payroll_fechamento_linha
    (periodo_id, employee_id, cod_folha, rubrica_id, valor, valor_horas, origem_lancamento, observacao)
  VALUES (p_periodo_id, p_employee_id, v_cod_folha, v_rubrica_id, p_valor,
          payroll_parse_hhmm(p_valor_horas), 'MANUAL', p_observacao)
  ON CONFLICT (periodo_id, employee_id, rubrica_id) DO UPDATE
    SET valor             = EXCLUDED.valor,
        valor_horas       = EXCLUDED.valor_horas,
        origem_lancamento = 'MANUAL',
        observacao        = EXCLUDED.observacao;

  UPDATE payroll_fechamento_periodo
  SET custo_total_folha = (
    SELECT COALESCE(SUM(pfl.valor),0)
    FROM payroll_fechamento_linha pfl
    JOIN payroll_rubricas pr ON pr.id = pfl.rubrica_id
    WHERE pfl.periodo_id = p_periodo_id
      AND pr.tipo = 'PROVENTO' AND pr.unidade = 'R$' AND pfl.valor IS NOT NULL)
  WHERE id = p_periodo_id;

  RETURN jsonb_build_object('ok', true, 'periodo_id', p_periodo_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$_$;


ALTER FUNCTION "public"."rpc_payroll_upsert_lancamento_manual"("p_periodo_id" "uuid", "p_employee_id" "uuid", "p_cod_kph" "text", "p_valor" numeric, "p_valor_horas" "text", "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_survey_responses"("p_responses" json) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO climate_survey_responses
    (survey_id, question_id, employee_id, nota, resposta)
  SELECT
    (r->>'survey_id')::uuid,
    (r->>'question_id')::uuid,
    CASE WHEN r->>'employee_id' IS NULL THEN NULL
         ELSE (r->>'employee_id')::uuid END,
    CASE WHEN r->>'resposta_valor' IS NULL THEN NULL
         ELSE (r->>'resposta_valor')::numeric END,
    COALESCE(r->>'resposta_texto', r->>'resposta_opcao')
  FROM json_array_elements(p_responses) AS r;
END;
$$;


ALTER FUNCTION "public"."submit_survey_responses"("p_responses" json) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_survey_responses"("p_employee_id" "uuid", "p_survey_id" "uuid", "p_responses" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE r jsonb;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_responses) LOOP
    INSERT INTO climate_responses (survey_id, question_id, employee_id, valor_escala, texto_livre)
    VALUES (p_survey_id, (r->>'question_id')::uuid, p_employee_id, (r->>'valor_escala')::int, r->>'texto_livre')
    ON CONFLICT (question_id, employee_id) DO UPDATE
      SET valor_escala = EXCLUDED.valor_escala, texto_livre = EXCLUDED.texto_livre, respondido_em = now();
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."submit_survey_responses"("p_employee_id" "uuid", "p_survey_id" "uuid", "p_responses" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_employee_photo"("p_employee_id" "uuid", "p_photo_url" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  UPDATE employees SET photo_url = p_photo_url WHERE id = p_employee_id;
$$;


ALTER FUNCTION "public"."update_employee_photo"("p_employee_id" "uuid", "p_photo_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_avaliacao"("p_candidate_id" "uuid", "p_aderencia" numeric, "p_experiencia" numeric, "p_tec" numeric, "p_comp" numeric, "p_aderencia_ia" boolean, "p_experiencia_ia" boolean) RETURNS "public"."candidate_avaliacao"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE r public.candidate_avaliacao;
BEGIN
  INSERT INTO public.candidate_avaliacao
    (candidate_id, aderencia_skills, experiencia, entrevista_tec, entrevista_comp,
     aderencia_ia_sugerida, experiencia_ia_sugerida)
  VALUES
    (p_candidate_id, p_aderencia, p_experiencia, p_tec, p_comp,
     p_aderencia_ia, p_experiencia_ia)
  ON CONFLICT (candidate_id) DO UPDATE SET
    aderencia_skills        = EXCLUDED.aderencia_skills,
    experiencia             = EXCLUDED.experiencia,
    entrevista_tec          = EXCLUDED.entrevista_tec,
    entrevista_comp         = EXCLUDED.entrevista_comp,
    aderencia_ia_sugerida   = EXCLUDED.aderencia_ia_sugerida,
    experiencia_ia_sugerida = EXCLUDED.experiencia_ia_sugerida,
    updated_at              = now()
  RETURNING * INTO r;
  RETURN r;
END $$;


ALTER FUNCTION "public"."upsert_avaliacao"("p_candidate_id" "uuid", "p_aderencia" numeric, "p_experiencia" numeric, "p_tec" numeric, "p_comp" numeric, "p_aderencia_ia" boolean, "p_experiencia_ia" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargo_salarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cargo_id" "uuid" NOT NULL,
    "nivel" integer,
    "unit_id" "uuid",
    "salario_min" numeric(10,2),
    "salario_ref" numeric(10,2),
    "salario_max" numeric(10,2),
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_faixa" CHECK ((("salario_min" IS NULL) OR ("salario_max" IS NULL) OR ("salario_min" <= "salario_max"))),
    CONSTRAINT "chk_nivel_valido" CHECK ((("nivel" IS NULL) OR (("nivel" >= 1) AND ("nivel" <= 3))))
);


ALTER TABLE "public"."cargo_salarios" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_cargo_salario"("p_id" "uuid", "p_salario_min" numeric, "p_salario_ref" numeric, "p_salario_max" numeric, "p_observacao" "text" DEFAULT NULL::"text") RETURNS "public"."cargo_salarios"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare r cargo_salarios;
begin
  update cargo_salarios
     set salario_min = p_salario_min,
         salario_ref = p_salario_ref,
         salario_max = p_salario_max,
         observacao  = coalesce(p_observacao, observacao),
         updated_at  = now()
   where id = p_id
  returning * into r;
  if not found then
    raise exception 'cargo_salario % não encontrado', p_id;
  end if;
  return r;
end; $$;


ALTER FUNCTION "public"."upsert_cargo_salario"("p_id" "uuid", "p_salario_min" numeric, "p_salario_ref" numeric, "p_salario_max" numeric, "p_observacao" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text") RETURNS "public"."candidate_feedback_operacional"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  r public.candidate_feedback_operacional;
BEGIN
  INSERT INTO public.candidate_feedback_operacional
    (candidate_id, agendamento_id,
     postura_apresentacao, ritmo_sob_pressao, dominio_tecnico,
     higiene_seguranca, trabalho_em_equipe, parecer)
  VALUES
    (p_candidate_id, p_agendamento_id,
     p_postura, p_ritmo, p_dominio, p_higiene, p_equipe, p_parecer)
  ON CONFLICT (candidate_id) DO UPDATE SET
    agendamento_id       = EXCLUDED.agendamento_id,
    postura_apresentacao = EXCLUDED.postura_apresentacao,
    ritmo_sob_pressao    = EXCLUDED.ritmo_sob_pressao,
    dominio_tecnico      = EXCLUDED.dominio_tecnico,
    higiene_seguranca    = EXCLUDED.higiene_seguranca,
    trabalho_em_equipe   = EXCLUDED.trabalho_em_equipe,
    parecer              = EXCLUDED.parecer,
    updated_at           = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;


ALTER FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid" DEFAULT NULL::"uuid", "p_postura" numeric DEFAULT NULL::numeric, "p_ritmo" numeric DEFAULT NULL::numeric, "p_dominio" numeric DEFAULT NULL::numeric, "p_higiene" numeric DEFAULT NULL::numeric, "p_equipe" numeric DEFAULT NULL::numeric, "p_parecer" "text" DEFAULT NULL::"text", "p_avaliador_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."candidate_feedback_operacional"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE r public.candidate_feedback_operacional;
BEGIN
  INSERT INTO public.candidate_feedback_operacional AS f
    (candidate_id, agendamento_id, postura_apresentacao, ritmo_sob_pressao,
     dominio_tecnico, higiene_seguranca, trabalho_em_equipe, parecer, avaliador_id)
  VALUES (p_candidate_id, p_agendamento_id, p_postura, p_ritmo,
          p_dominio, p_higiene, p_equipe, p_parecer, p_avaliador_id)
  ON CONFLICT (candidate_id) DO UPDATE SET
    agendamento_id       = COALESCE(EXCLUDED.agendamento_id, f.agendamento_id),
    postura_apresentacao = COALESCE(EXCLUDED.postura_apresentacao, f.postura_apresentacao),
    ritmo_sob_pressao    = COALESCE(EXCLUDED.ritmo_sob_pressao, f.ritmo_sob_pressao),
    dominio_tecnico      = COALESCE(EXCLUDED.dominio_tecnico, f.dominio_tecnico),
    higiene_seguranca    = COALESCE(EXCLUDED.higiene_seguranca, f.higiene_seguranca),
    trabalho_em_equipe   = COALESCE(EXCLUDED.trabalho_em_equipe, f.trabalho_em_equipe),
    parecer              = COALESCE(EXCLUDED.parecer, f.parecer),
    avaliador_id         = COALESCE(EXCLUDED.avaliador_id, f.avaliador_id),
    updated_at           = now()
  RETURNING * INTO r;
  RETURN r;
END;
$$;


ALTER FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text", "p_avaliador_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_push_token"("p_employee_id" "uuid", "p_token" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE employees
  SET
    push_token = p_token,
    push_token_updated_at = now()
  WHERE id = p_employee_id;
END;
$$;


ALTER FUNCTION "public"."upsert_push_token"("p_employee_id" "uuid", "p_token" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_action_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "responsavel_id" "uuid",
    "prazo" "date",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "mise"."checklist_action_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_execution_topicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "topico_ordem" integer NOT NULL,
    "topico_nome" "text" NOT NULL,
    "percentual" numeric
);


ALTER TABLE "mise"."checklist_execution_topicos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "turno" "text",
    "iniciado_por" "uuid",
    "status" "text" DEFAULT 'em_andamento'::"text" NOT NULL,
    "pontuacao_total" integer,
    "pontuacao_obtida" integer,
    "percentual" numeric(5,2),
    "iniciado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concluido_em" timestamp with time zone,
    "agendado_para" timestamp with time zone,
    "agendado_por" "uuid",
    "local_id" "uuid",
    "geo_inicio_lat" numeric,
    "geo_inicio_lng" numeric,
    "geo_fim_lat" numeric,
    "geo_fim_lng" numeric
);


ALTER TABLE "mise"."checklist_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "resposta" "jsonb",
    "comentario" "text",
    "nao_aplicavel" boolean DEFAULT false NOT NULL,
    "respondido_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "foto_url" "text"
);


ALTER TABLE "mise"."checklist_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "tipo_resposta" "text" DEFAULT 'sim_nao'::"text" NOT NULL,
    "opcoes" "jsonb",
    "peso" integer DEFAULT 1 NOT NULL,
    "requer_comentario" "text" DEFAULT 'nao'::"text" NOT NULL,
    "is_turno_item" boolean DEFAULT false NOT NULL,
    "criterio_regramento" "text",
    "requer_foto" "text" DEFAULT 'nao'::"text" NOT NULL,
    "topico_ordem" integer,
    "topico_nome" "text"
);


ALTER TABLE "mise"."checklist_template_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "tipo" "text" DEFAULT 'abertura'::"text" NOT NULL,
    "unit_id" "uuid",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modulo" "text" DEFAULT 'RITMO'::"text" NOT NULL,
    "categoria" "text"
);


ALTER TABLE "mise"."checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."crivo_locais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "endereco" "text"
);


ALTER TABLE "mise"."crivo_locais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."debug_responder" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "execution_id" "uuid",
    "item_id" "uuid",
    "foto_url" "text",
    "resposta" "jsonb",
    "branch" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "mise"."debug_responder" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."ingredient_shelf_life" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "metodo_conservacao" "text" NOT NULL,
    "prazo_horas" integer NOT NULL
);


ALTER TABLE "mise"."ingredient_shelf_life" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."inventory_count_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "count_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "nome" "text" NOT NULL,
    "unidade" "text" NOT NULL,
    "quantidade" numeric DEFAULT 0 NOT NULL,
    "peso_kg" numeric,
    "custo_unitario" numeric DEFAULT 0 NOT NULL,
    "valor_total" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "mise"."inventory_count_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."inventory_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "tipo" "text" DEFAULT 'parcial'::"text",
    "status" "text" DEFAULT 'em_andamento'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_counts_status_check" CHECK (("status" = ANY (ARRAY['em_andamento'::"text", 'concluido'::"text"]))),
    CONSTRAINT "inventory_counts_tipo_check" CHECK (("tipo" = ANY (ARRAY['parcial'::"text", 'completo'::"text"])))
);


ALTER TABLE "mise"."inventory_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "production_order_id" "uuid",
    "ingredient_id" "uuid",
    "menu_item_id" "uuid",
    "tipo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "peso_kg" numeric,
    "lote" "text",
    "metodo_conservacao" "text",
    "data_manipulacao" timestamp with time zone DEFAULT "now"() NOT NULL,
    "validade" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'ativa'::"text" NOT NULL,
    "printed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "print_point_id" "uuid",
    "setor" "text",
    "selo" "text",
    "validade_fornecedor" "date",
    "responsavel_nome" "text",
    "responsavel_id" "uuid",
    CONSTRAINT "labels_status_check" CHECK (("status" = ANY (ARRAY['ativa'::"text", 'consumida'::"text", 'descartada'::"text", 'vencida'::"text"]))),
    CONSTRAINT "labels_tipo_check" CHECK (("tipo" = ANY (ARRAY['ingrediente'::"text", 'preparacao'::"text", 'porcao'::"text"])))
);


ALTER TABLE "mise"."labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."print_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icone" "text",
    "rede" "text",
    "status" "text" DEFAULT 'online'::"text",
    "ip_address" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "print_points_status_check" CHECK (("status" = ANY (ARRAY['online'::"text", 'offline'::"text"])))
);


ALTER TABLE "mise"."print_points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."production_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "menu_item_id" "uuid",
    "nome" "text" NOT NULL,
    "employee_id" "uuid",
    "status" "text" DEFAULT 'em_andamento'::"text" NOT NULL,
    "quantidade_porcoes" numeric DEFAULT 1 NOT NULL,
    "peso_bruto_kg" numeric,
    "peso_liquido_kg" numeric,
    "rendimento_real_pct" numeric,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "production_orders_status_check" CHECK (("status" = ANY (ARRAY['em_andamento'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "mise"."production_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."receiving_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receiving_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "nome" "text" NOT NULL,
    "unidade" "text" NOT NULL,
    "quantidade_nf" numeric NOT NULL,
    "peso_bruto_real" numeric,
    "tara" numeric DEFAULT 0,
    "peso_liquido_real" numeric,
    "temperatura" numeric,
    "preco_unitario" numeric DEFAULT 0 NOT NULL,
    "lote" "text",
    "validade_fornecedor" "date",
    "status" "text" DEFAULT 'aprovado'::"text",
    "motivo_rejeicao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "receiving_items_status_check" CHECK (("status" = ANY (ARRAY['aprovado'::"text", 'rejeitado'::"text", 'parcial'::"text"])))
);


ALTER TABLE "mise"."receiving_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."receiving_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid",
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "receiving_records_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text", 'parcial'::"text"])))
);


ALTER TABLE "mise"."receiving_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."responsaveis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "mise"."responsaveis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."responsavel_unidades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "responsavel_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL
);


ALTER TABLE "mise"."responsavel_unidades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '12:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "mise"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."shelf_life_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "categoria" "text" NOT NULL,
    "metodo_conservacao" "text" NOT NULL,
    "prazo_horas" integer NOT NULL,
    "referencia" "text" DEFAULT 'Portaria 2619/2011 - Município de SP'::"text",
    "ativo" boolean DEFAULT true
);


ALTER TABLE "mise"."shelf_life_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."user_pins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "role" "text" DEFAULT 'cozinheiro'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_pins_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'gerente'::"text", 'cozinheiro'::"text"])))
);


ALTER TABLE "mise"."user_pins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "mise"."waste_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "label_id" "uuid",
    "ingredient_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo_perda" "text" NOT NULL,
    "quantidade" numeric DEFAULT 0 NOT NULL,
    "peso_kg" numeric,
    "custo_unitario" numeric DEFAULT 0 NOT NULL,
    "custo_total" numeric,
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "waste_records_tipo_perda_check" CHECK (("tipo_perda" = ANY (ARRAY['vencimento'::"text", 'producao'::"text", 'recebimento'::"text", 'acidente'::"text", 'outro'::"text"])))
);


ALTER TABLE "mise"."waste_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "opx"."event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "module" "text" NOT NULL,
    "type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "occurred_at" timestamp with time zone NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "opx"."event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "opx"."evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "opx"."evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."Comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."Projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Task_Assignees" (
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."Task_Assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    CONSTRAINT "Tasks_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'concluído'::"text"])))
);


ALTER TABLE "public"."Tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Team_Members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL
);


ALTER TABLE "public"."Team_Members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."absences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "tipo" "text" NOT NULL,
    "motivo" "text",
    "score_impact" integer DEFAULT 0,
    "atestado_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."absences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "email" "text" NOT NULL,
    "cpf" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approver_tier" "text" NOT NULL,
    "approver_id" "uuid",
    "approved_at" timestamp with time zone,
    "rejected_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "access_requests_approver_tier_check" CHECK (("approver_tier" = ANY (ARRAY['T2A'::"text", 'T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"]))),
    CONSTRAINT "access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_plan_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "descricao" "text" NOT NULL,
    "responsavel_id" "uuid",
    "prazo" "date",
    "status" "text" DEFAULT 'pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_plan_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."action_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "origem" "text",
    "origem_id" "uuid",
    "status" "text" DEFAULT 'aberto'::"text",
    "prazo" "date",
    "responsavel_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'ativa'::"text",
    "operator_id" "uuid",
    "operator_name" "text",
    "session_type" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    CONSTRAINT "agent_conversations_session_type_check" CHECK (("session_type" = ANY (ARRAY['whatsapp'::"text", 'web'::"text"])))
);

ALTER TABLE ONLY "public"."agent_conversations" REPLICA IDENTITY FULL;


ALTER TABLE "public"."agent_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" "text" NOT NULL,
    "phone_last4" "text",
    "input_tokens" integer,
    "output_tokens" integer,
    "cost_usd" numeric(10,6),
    "latency_ms" integer,
    "intencao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent" "text" NOT NULL,
    "version" "text" NOT NULL,
    "system_prompt" "text" NOT NULL,
    "ativado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ativado_por" "uuid",
    "nota" "text",
    "ativo" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_prompt_versions_agent_check" CHECK (("agent" = ANY (ARRAY['maya'::"text", 'theo'::"text"])))
);


ALTER TABLE "public"."agent_prompt_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."agent_prompt_versions" IS 'Histórico de versões dos system prompts dos agentes IA Maya e Theo.';



CREATE TABLE IF NOT EXISTS "public"."agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "triggered_by" "text",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "duration_seconds" integer,
    "output_summary" "text",
    "week_number" integer NOT NULL,
    "year" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_runs_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "departamento" "text",
    "cargo" "text",
    "periodo_inicio" "date" NOT NULL,
    "periodo_fim" "date" NOT NULL,
    "horas_trabalhadas_min" integer DEFAULT 0 NOT NULL,
    "adicional_noturno_min" integer DEFAULT 0 NOT NULL,
    "documento_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attendance_summaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource" "text" NOT NULL,
    "resource_id" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auditoria_nutricional" (
    "id" integer NOT NULL,
    "data_inspecao" "date" NOT NULL,
    "nota" numeric,
    "status" "text",
    "local" "text",
    "tipo_inspecao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auditoria_nutricional" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."auditoria_nutricional_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."auditoria_nutricional_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."auditoria_nutricional_id_seq" OWNED BY "public"."auditoria_nutricional"."id";



CREATE TABLE IF NOT EXISTS "public"."auth_rate_limits" (
    "identifier_hash" "text" NOT NULL,
    "action" "text" NOT NULL,
    "failures" integer DEFAULT 0 NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "blocked_until" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auth_rate_limits_failures_check" CHECK (("failures" >= 0))
);


ALTER TABLE "public"."auth_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacao_ciclos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "template_id" "uuid",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "avaliacao_ciclos_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'em_andamento'::"text", 'encerrado'::"text"])))
);


ALTER TABLE "public"."avaliacao_ciclos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avaliacao_participantes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ciclo_id" "uuid" NOT NULL,
    "avaliado_id" "uuid" NOT NULL,
    "avaliador_id" "uuid" NOT NULL,
    "tipo_avaliador" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text",
    "review_id" "uuid",
    CONSTRAINT "avaliacao_participantes_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'concluido'::"text"]))),
    CONSTRAINT "avaliacao_participantes_tipo_avaliador_check" CHECK (("tipo_avaliador" = ANY (ARRAY['autoavaliacao'::"text", 'par'::"text", 'gestor'::"text", 'liderado'::"text"])))
);


ALTER TABLE "public"."avaliacao_participantes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "url" "text" NOT NULL,
    "label" "text",
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brand_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "periodo" "text" NOT NULL,
    "receita_meta" numeric(12,2),
    "cmv_meta_pct" numeric(5,2),
    "prime_cost_meta_pct" numeric(5,2),
    "ticket_medio_meta" numeric(10,2),
    "nps_meta" numeric(5,2),
    "headcount_meta" integer,
    "eventos_meta" integer,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brand_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "color" "text" DEFAULT '#D4A574'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."brands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buckets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "unit_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "category" "text" NOT NULL,
    "target" "text" DEFAULT 'all'::"text" NOT NULL,
    "target_value" "text",
    "active" boolean DEFAULT true,
    "starts_at" "date",
    "ends_at" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "campaigns_category_check" CHECK (("category" = ANY (ARRAY['saude'::"text", 'evento'::"text", 'comunicado'::"text"]))),
    CONSTRAINT "campaigns_target_check" CHECK (("target" = ANY (ARRAY['all'::"text", 'department'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_agendamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "data_hora" timestamp with time zone NOT NULL,
    "duracao_min" integer DEFAULT 30 NOT NULL,
    "modalidade" "text",
    "local" "text",
    "unit_id" "uuid",
    "responsavel_id" "uuid",
    "status" "text" DEFAULT 'agendado'::"text" NOT NULL,
    "observacoes" "text",
    "google_event_id" "text",
    "google_meet_link" "text",
    "transcricao_drive_id" "text",
    "resumo_ia" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "candidate_agendamentos_modalidade_check" CHECK (("modalidade" = ANY (ARRAY['presencial'::"text", 'video'::"text", 'telefone'::"text"]))),
    CONSTRAINT "candidate_agendamentos_status_check" CHECK (("status" = ANY (ARRAY['agendado'::"text", 'realizado'::"text", 'cancelado'::"text", 'nao_compareceu'::"text"]))),
    CONSTRAINT "candidate_agendamentos_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrevista'::"text", 'teste_pratico'::"text"])))
);


ALTER TABLE "public"."candidate_agendamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_pipeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "etapa" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "responsavel_id" "uuid",
    "data_agendamento" timestamp with time zone,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "de_status" "text",
    "para_status" "text",
    "motivo" "text",
    "autor_id" "uuid",
    CONSTRAINT "candidate_pipeline_de_status_check" CHECK ((("de_status" IS NULL) OR ("de_status" = ANY (ARRAY['novo'::"text", 'triagem'::"text", 'agendamento'::"text", 'entrevista'::"text", 'avaliacao_administrativa'::"text", 'entrevista_diretoria'::"text", 'agendamento_teste'::"text", 'feedback_operacional'::"text", 'decisao'::"text", 'aprovado'::"text", 'contratado'::"text", 'banco_talentos'::"text", 'reprovado'::"text", 'desistiu'::"text"])))),
    CONSTRAINT "candidate_pipeline_para_status_check" CHECK ((("para_status" IS NULL) OR ("para_status" = ANY (ARRAY['novo'::"text", 'triagem'::"text", 'agendamento'::"text", 'entrevista'::"text", 'avaliacao_administrativa'::"text", 'entrevista_diretoria'::"text", 'agendamento_teste'::"text", 'feedback_operacional'::"text", 'decisao'::"text", 'aprovado'::"text", 'contratado'::"text", 'banco_talentos'::"text", 'reprovado'::"text", 'desistiu'::"text"])))),
    CONSTRAINT "candidate_pipeline_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'reprovado'::"text"]))))
);


ALTER TABLE "public"."candidate_pipeline" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidate_pipeline" IS '1 linha por transição de status. de_status/para_status = vocabulário do kanban. etapa/data_agendamento/feedback = sub-feature de agendamento (FASE 4).';



COMMENT ON COLUMN "public"."candidate_pipeline"."de_status" IS 'Status do candidato antes da transição.';



COMMENT ON COLUMN "public"."candidate_pipeline"."para_status" IS 'Status do candidato após a transição.';



COMMENT ON COLUMN "public"."candidate_pipeline"."motivo" IS 'Motivo da transição (reprovação, desistência, banco de talentos, etc.).';



COMMENT ON COLUMN "public"."candidate_pipeline"."autor_id" IS 'FK employees: colaborador que executou a ação.';



CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_opening_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "access_code" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "interview_status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    "origem" "text" DEFAULT 'manual'::"text" NOT NULL,
    "area_interesse" "text",
    "nota_maya" numeric(3,1),
    "conversa_id" "uuid",
    "disc_profile" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responsavel_id" "uuid",
    "entrevistador_id" "uuid",
    "observacoes" "text",
    "welcome_message_sid" "text",
    "welcome_delivery_status" "text",
    "welcome_sent_at" timestamp with time zone,
    "welcome_error_code" "text",
    "origem_id" "uuid",
    "cidade" "text",
    "escolaridade_nivel" "text",
    "pretensao_salarial" numeric(10,2),
    "disponibilidade_inicio" "date",
    "turnos_disponiveis" "text"[] DEFAULT '{}'::"text"[],
    "bairro" "text",
    "cv_storage_path" "text",
    "experiencias" "jsonb" DEFAULT '[]'::"jsonb",
    "formacoes" "jsonb" DEFAULT '[]'::"jsonb",
    "idiomas" "jsonb" DEFAULT '[]'::"jsonb",
    "habilidades" "text"[] DEFAULT '{}'::"text"[],
    "cargo_id" "uuid",
    "requer_entrevista_diretoria" boolean,
    CONSTRAINT "candidates_escolaridade_nivel_check" CHECK ((("escolaridade_nivel" IS NULL) OR ("escolaridade_nivel" = ANY (ARRAY['analfabeto'::"text", 'fundamental_5_incompleto'::"text", 'fundamental_5_completo'::"text", 'fundamental_6_9'::"text", 'fundamental_completo'::"text", 'medio_incompleto'::"text", 'medio_completo'::"text", 'superior_incompleto'::"text", 'superior_completo'::"text", 'pos_graduacao'::"text"])))),
    CONSTRAINT "candidates_interview_status_check" CHECK (("interview_status" = ANY (ARRAY['pendente'::"text", 'em_andamento'::"text", 'concluido'::"text"]))),
    CONSTRAINT "candidates_origem_check" CHECK ((("origem" IS NULL) OR ("origem" = ANY (ARRAY['maya'::"text", 'portal'::"text", 'indicacao_colaborador'::"text", 'indicacao'::"text", 'linkedin'::"text", 'indeed'::"text", 'catho'::"text", 'vagas_com_br'::"text", 'infojobs'::"text", 'instagram'::"text", 'mutirao'::"text", 'busca_ativa'::"text", 'banco_talentos_reativado'::"text", 'escola'::"text", 'sindicato'::"text", 'abordagem'::"text", 'manual'::"text", 'outro'::"text", 'maya_whatsapp'::"text", 'portal_kph'::"text"])))),
    CONSTRAINT "candidates_status_check" CHECK (("status" = ANY (ARRAY['novo'::"text", 'triagem'::"text", 'agendamento'::"text", 'entrevista'::"text", 'avaliacao_administrativa'::"text", 'entrevista_diretoria'::"text", 'agendamento_teste'::"text", 'feedback_operacional'::"text", 'decisao'::"text", 'aprovado'::"text", 'contratado'::"text", 'reprovado'::"text", 'desistiu'::"text", 'banco_talentos'::"text"])))
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";


COMMENT ON TABLE "public"."candidates" IS 'Candidatos captados pela Maya (WhatsApp) ou manualmente para vagas KPH.';



COMMENT ON COLUMN "public"."candidates"."escolaridade_nivel" IS 'Nível de escolaridade (slug). 10 valores — ver CHECK.';



COMMENT ON COLUMN "public"."candidates"."pretensao_salarial" IS 'Pretensão salarial bruta em R$.';



COMMENT ON COLUMN "public"."candidates"."disponibilidade_inicio" IS 'Data de disponibilidade para início.';



COMMENT ON COLUMN "public"."candidates"."turnos_disponiveis" IS 'Turnos disponíveis para trabalho. Ex: {manhã, noite}.';



COMMENT ON COLUMN "public"."candidates"."cv_storage_path" IS 'Caminho no bucket candidate-cvs. Download via signed URL (3600s).';



COMMENT ON COLUMN "public"."candidates"."experiencias" IS '[{empresa, cargo, inicio, fim, descricao}]';



COMMENT ON COLUMN "public"."candidates"."formacoes" IS '[{instituicao, curso, nivel, ano_conclusao}]';



COMMENT ON COLUMN "public"."candidates"."idiomas" IS '[{idioma, nivel}] nivel: basico|intermediario|avancado|fluente';



CREATE TABLE IF NOT EXISTS "public"."candidatos_maya" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "area_interesse" "text",
    "cargo_interesse" "text",
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "source" "text" DEFAULT 'whatsapp'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidatos_maya_status_check" CHECK (("status" = ANY (ARRAY['novo'::"text", 'triagem'::"text", 'entrevista'::"text", 'aprovado'::"text", 'reprovado'::"text", 'desistiu'::"text"])))
);


ALTER TABLE "public"."candidatos_maya" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargo_grupos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "sla_dias_uteis" integer NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cargo_grupos_sla_dias_uteis_check" CHECK (("sla_dias_uteis" > 0))
);


ALTER TABLE "public"."cargo_grupos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cargos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "setor" "text" NOT NULL,
    "grupo" "text" NOT NULL,
    "tem_nivel" boolean DEFAULT false NOT NULL,
    "sinonimos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reporta_a_cargo_id" "uuid",
    "ordem_hierarquia" integer,
    "requer_entrevista_diretoria" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cargos_grupo_chk" CHECK (("grupo" = ANY (ARRAY['Operacional'::"text", 'Tático'::"text", 'Estratégico'::"text", 'Executivo-Liderança'::"text"]))),
    CONSTRAINT "cargos_setor_chk" CHECK (("setor" = ANY (ARRAY['Gerência'::"text", 'Bar'::"text", 'Salão'::"text", 'Limpeza'::"text", 'Cozinha'::"text", 'Estoque'::"text"])))
);


ALTER TABLE "public"."cargos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cct_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sindicato" "text" NOT NULL,
    "vigencia_inicio" "date" NOT NULL,
    "vigencia_fim" "date" NOT NULL,
    "piso_salarial" numeric(10,2),
    "adicional_noturno_pct" numeric(5,2) DEFAULT 20,
    "hora_extra_50_pct" numeric(5,2) DEFAULT 50,
    "hora_extra_100_pct" numeric(5,2) DEFAULT 100,
    "gorjeta_percentual" numeric(5,2),
    "dsr_sobre_gorjeta" boolean DEFAULT true,
    "dados_completos" "jsonb",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cct_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "turno" "public"."checklist_turno" NOT NULL,
    "responsavel_id" "uuid",
    "respostas" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "score_pct" integer,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checklist_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "descricao" "text",
    "data" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "client_interactions_tipo_check" CHECK (("tipo" = ANY (ARRAY['ligacao'::"text", 'email'::"text", 'whatsapp'::"text", 'reuniao'::"text", 'visita'::"text", 'outro'::"text"])))
);


ALTER TABLE "public"."client_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "email" "text",
    "telefone" "text",
    "empresa" "text",
    "origem" "text",
    "observacoes" "text",
    "ativo" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clients_origem_check" CHECK ((("origem" IS NULL) OR ("origem" = ANY (ARRAY['indicacao'::"text", 'site'::"text", 'instagram'::"text", 'whatsapp'::"text", 'evento'::"text", 'outro'::"text"]))))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "ordem" integer DEFAULT 1 NOT NULL,
    "texto" "text" NOT NULL,
    "tipo" "text" DEFAULT 'escala'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "climate_questions_tipo_check" CHECK (("tipo" = ANY (ARRAY['escala'::"text", 'texto_livre'::"text"])))
);


ALTER TABLE "public"."climate_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "valor_escala" integer,
    "texto_livre" "text",
    "respondido_em" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "climate_responses_valor_escala_check" CHECK ((("valor_escala" >= 1) AND ("valor_escala" <= 5)))
);


ALTER TABLE "public"."climate_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_survey_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid",
    "ordem" integer,
    "pergunta" "text" NOT NULL,
    "tipo" "text" DEFAULT 'escala'::"text",
    "opcoes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."climate_survey_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_survey_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid",
    "question_id" "uuid",
    "employee_id" "uuid",
    "resposta" "text",
    "nota" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."climate_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'rascunho'::"text",
    "data_inicio" "date",
    "data_fim" "date",
    "anonimo" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."climate_surveys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conferencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "alerta_chave" "text" NOT NULL,
    "assinatura" "text" NOT NULL,
    "status" "text" NOT NULL,
    "observacao" "text",
    "conferido_por" "text",
    "conferido_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conferencias_status_check" CHECK (("status" = ANY (ARRAY['conferido'::"text", 'ignorado'::"text"])))
);


ALTER TABLE "public"."conferencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contas_bancarias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "banco" "text" NOT NULL,
    "apelido" "text",
    "saldo_inicial" numeric(16,2) DEFAULT 0 NOT NULL,
    "data_saldo_inicial" "date" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."contas_bancarias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contatos_kph" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "telefone" "text" NOT NULL,
    "nome" "text",
    "tipo" "text" DEFAULT 'externo'::"text",
    "area_interesse" "text",
    "primeiro_contato" timestamp with time zone DEFAULT "now"(),
    "ultimo_contato" timestamp with time zone DEFAULT "now"(),
    "total_conversas" integer DEFAULT 1,
    "agentes_usados" "text"[] DEFAULT '{}'::"text"[],
    "employee_id" "uuid",
    "candidate_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "contatos_kph_tipo_check" CHECK (("tipo" = ANY (ARRAY['candidato'::"text", 'colaborador'::"text", 'externo'::"text"])))
);


ALTER TABLE "public"."contatos_kph" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "contractor_id" "uuid",
    "competencia" "date" NOT NULL,
    "valor_bruto" numeric(10,2),
    "valor_cash" numeric(10,2) DEFAULT 0,
    "desconto" numeric(10,2) DEFAULT 0,
    "valor_nota" numeric(10,2),
    "gorjeta_1q" numeric(10,2) DEFAULT 0,
    "gorjeta_2q" numeric(10,2) DEFAULT 0,
    "pgto_15" numeric(10,2),
    "pgto_30" numeric(10,2),
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contractor_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractor_vacations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "contractor_id" "uuid",
    "data_inicio" "date",
    "data_termino" "date",
    "total_dias" integer,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contractor_vacations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contractors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "cnpj" "text",
    "responsavel" "text" NOT NULL,
    "valor_mensal" numeric(10,2),
    "valor_nota" numeric(10,2),
    "setor" "text",
    "observacao" "text",
    "ativo" boolean DEFAULT true,
    "email" "text",
    "telefone" "text",
    "banco" "text",
    "banco_codigo" "text",
    "agencia" "text",
    "conta" "text",
    "cpf_responsavel" "text",
    "data_nascimento_responsavel" "date",
    "endereco" "text",
    "data_inicio_contrato" "date",
    "data_fim_contrato" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contractors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contratos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "titulo" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "contraparte" "text" NOT NULL,
    "contraparte_doc" "text",
    "responsavel" "text",
    "valor" numeric(14,2) DEFAULT 0,
    "recorrencia" "text",
    "data_inicio" "date",
    "data_fim" "date",
    "vigencia_indeterminada" boolean DEFAULT false,
    "renovacao_automatica" boolean DEFAULT false,
    "aviso_previo_dias" integer DEFAULT 0,
    "indice_reajuste" "text",
    "data_proximo_reajuste" "date",
    "multa_rescisoria" "text",
    "status_manual" "text",
    "tags" "text"[],
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contratos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contratos_arquivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contrato_id" "uuid" NOT NULL,
    "tipo" "text" DEFAULT 'principal'::"text" NOT NULL,
    "nome" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "tamanho_bytes" bigint,
    "content_type" "text" DEFAULT 'application/pdf'::"text",
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contratos_arquivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dependents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cpf" "text",
    "data_nascimento" "date",
    "parentesco" "text" NOT NULL,
    "ordem" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dependents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dho_tracking" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "tipo" "text",
    "competencia" "date",
    "score" numeric(5,2),
    "descricao" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dho_tracking" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disc_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "nome" "text",
    "perfil" "text",
    "descricao" "text",
    "data_avaliacao" "date",
    "documento_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."disc_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."disciplinary_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "tipo" "text",
    "data" "date",
    "motivo" "text",
    "documento_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."disciplinary_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text",
    "unidade" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "unit_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'outro'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "notes" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "documents_type_check" CHECK (("type" = ANY (ARRAY['rg_cnh'::"text", 'cpf'::"text", 'residencia'::"text", 'foto_3x4'::"text", 'ctps'::"text", 'exame_admissional'::"text", 'dados_bancarios'::"text", 'certidao_filhos'::"text", 'atestado'::"text", 'declaracao_ir'::"text", 'outro'::"text", 'RG'::"text", 'CPF'::"text", 'CTPS'::"text", 'contrato'::"text", 'exame'::"text", 'relatorio_folha'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dre_contratos_fixos" (
    "id" bigint NOT NULL,
    "razao_social" "text" NOT NULL,
    "descricao" "text",
    "valor_mensal" numeric NOT NULL,
    "codigo_contabil" "text",
    "tipo" "text",
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_contratos_fixos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_contratos_fixos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_contratos_fixos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_contratos_fixos_id_seq" OWNED BY "public"."dre_contratos_fixos"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_despesa_detalhada" (
    "id" integer NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "data_competencia" "date",
    "descricao" "text",
    "categoria" character varying(100),
    "valor" numeric NOT NULL,
    "classificacao_dre" character varying(100),
    "tipo_despesa" character varying(60),
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_despesa_detalhada" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_despesa_detalhada_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_despesa_detalhada_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_despesa_detalhada_id_seq" OWNED BY "public"."dre_despesa_detalhada"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_faturamento_historico" (
    "id" integer NOT NULL,
    "mes_num" smallint NOT NULL,
    "categoria" character varying(20) NOT NULL,
    "rec_2022" numeric,
    "rec_2023" numeric,
    "rec_2024" numeric,
    "rec_2025" numeric,
    "rec_2026_bd" numeric,
    "clientes_bd" integer,
    "ticket_bd" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    CONSTRAINT "dre_faturamento_historico_categoria_check" CHECK ((("categoria")::"text" = ANY (ARRAY[('restaurante'::character varying)::"text", ('eventos'::character varying)::"text", ('total'::character varying)::"text"]))),
    CONSTRAINT "dre_faturamento_historico_mes_num_check" CHECK ((("mes_num" >= 1) AND ("mes_num" <= 12)))
);


ALTER TABLE "public"."dre_faturamento_historico" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_faturamento_historico_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_faturamento_historico_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_faturamento_historico_id_seq" OWNED BY "public"."dre_faturamento_historico"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_folha" (
    "id" integer NOT NULL,
    "tipo" character varying(10) NOT NULL,
    "nome" character varying(120),
    "funcao" character varying(80) NOT NULL,
    "divisao" character varying(40) NOT NULL,
    "admissao" "date",
    "salario" numeric NOT NULL,
    "custo_total" numeric NOT NULL,
    "is_vaga" boolean DEFAULT false NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    "competencia" "text",
    "total_proventos" numeric DEFAULT 0 NOT NULL,
    "total_descontos" numeric DEFAULT 0 NOT NULL,
    "valor_liquido" numeric DEFAULT 0 NOT NULL,
    "base_inss" numeric DEFAULT 0 NOT NULL,
    "base_fgts" numeric DEFAULT 0 NOT NULL,
    "fgts_mes" numeric DEFAULT 0 NOT NULL,
    "base_irrf" numeric DEFAULT 0 NOT NULL,
    "gorjeta" numeric DEFAULT 0 NOT NULL,
    "verbas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "documento_path" "text",
    "documento_nome" "text",
    "documento_pagina" integer,
    "texto_origem" "text"
);


ALTER TABLE "public"."dre_folha" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_folha_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_folha_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_folha_id_seq" OWNED BY "public"."dre_folha"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_gorjeta_mensal" (
    "id" integer NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "gorjeta_recebida" numeric,
    "gorjeta_paga" numeric,
    "retencao" numeric,
    "ferias" numeric,
    "decimo_terceiro" numeric,
    "fgts" numeric,
    "inss" numeric,
    "encargos_total" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_gorjeta_mensal" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_gorjeta_mensal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_gorjeta_mensal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_gorjeta_mensal_id_seq" OWNED BY "public"."dre_gorjeta_mensal"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_indicadores" (
    "id" integer NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "indicador" character varying(40) NOT NULL,
    "valor" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    CONSTRAINT "dre_indicadores_tipo_check" CHECK ((("tipo")::"text" = ANY (ARRAY[('orcado'::character varying)::"text", ('realizado'::character varying)::"text"])))
);


ALTER TABLE "public"."dre_indicadores" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_indicadores_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_indicadores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_indicadores_id_seq" OWNED BY "public"."dre_indicadores"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_kpis_mensais" (
    "mes_ano" "text" NOT NULL,
    "clientes" integer,
    "ticket_medio" numeric,
    "gorjetas_recebidas" numeric,
    "icms" numeric,
    "cofins" numeric,
    "pis" numeric,
    "iss" numeric,
    "unit_id" "uuid" NOT NULL
);


ALTER TABLE "public"."dre_kpis_mensais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dre_linhas_detalhadas" (
    "id" bigint NOT NULL,
    "mes_ano" character varying NOT NULL,
    "tipo" character varying NOT NULL,
    "grupo" character varying NOT NULL,
    "descricao" character varying NOT NULL,
    "conta" character varying,
    "custo_tipo" character varying,
    "valor" numeric,
    "av_percentual" numeric,
    "criado_em" timestamp without time zone DEFAULT "now"(),
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_linhas_detalhadas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_linhas_detalhadas_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_linhas_detalhadas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_linhas_detalhadas_id_seq" OWNED BY "public"."dre_linhas_detalhadas"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_manutencao_detalhada" (
    "id" bigint NOT NULL,
    "mes_ano" "text",
    "fornecedor" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_manutencao_detalhada" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_manutencao_detalhada_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_manutencao_detalhada_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_manutencao_detalhada_id_seq" OWNED BY "public"."dre_manutencao_detalhada"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_mensal" (
    "id" integer NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "tipo" character varying(20) NOT NULL,
    "receita_bruta" numeric,
    "cmv" numeric,
    "pessoal" numeric,
    "ocupacao" numeric,
    "utilidades" numeric,
    "operacao" numeric,
    "manutencao" numeric,
    "administrativa" numeric,
    "marketing" numeric,
    "taxa_cartao" numeric,
    "impostos" numeric,
    "ebitda" numeric,
    "resultado_liquido" numeric,
    "clientes" integer,
    "ticket_medio" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid",
    CONSTRAINT "dre_mensal_tipo_check" CHECK ((("tipo")::"text" = ANY (ARRAY[('orcado'::character varying)::"text", ('realizado'::character varying)::"text"])))
);


ALTER TABLE "public"."dre_mensal" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_mensal_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_mensal_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_mensal_id_seq" OWNED BY "public"."dre_mensal"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_pessoal_detalhado" (
    "id" bigint NOT NULL,
    "mes_ano" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "valor" numeric,
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_pessoal_detalhado" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_pessoal_detalhado_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_pessoal_detalhado_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_pessoal_detalhado_id_seq" OWNED BY "public"."dre_pessoal_detalhado"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_prestadores" (
    "id" bigint NOT NULL,
    "mes_ano" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "grupo" "text" NOT NULL,
    "valor" numeric NOT NULL,
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_prestadores" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_prestadores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_prestadores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_prestadores_id_seq" OWNED BY "public"."dre_prestadores"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_receita_detalhada" (
    "id" integer NOT NULL,
    "mes_ano" character varying(7) NOT NULL,
    "bandeira" character varying(50) NOT NULL,
    "classificacao" character varying(60) NOT NULL,
    "grupo" character varying(40) NOT NULL,
    "valor" numeric NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "unit_id" "uuid"
);


ALTER TABLE "public"."dre_receita_detalhada" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."dre_receita_detalhada_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."dre_receita_detalhada_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."dre_receita_detalhada_id_seq" OWNED BY "public"."dre_receita_detalhada"."id";



CREATE TABLE IF NOT EXISTS "public"."dre_snapshot" (
    "unit_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "conta_codigo" "text" NOT NULL,
    "valor" numeric(16,2) NOT NULL,
    "qtd_lancamentos" integer NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dre_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_auth" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "cpf" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "disponivel" boolean DEFAULT false NOT NULL,
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "tipo" "text",
    "valor" numeric(10,2),
    "competencia" "date",
    "detalhes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_codigos_dominio" (
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "cod_folha" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_codigos_dominio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "file_path" "text" DEFAULT ''::"text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "data_emissao" "date",
    "data_validade" "date",
    "observacoes" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "employee_documents_tipo_check" CHECK (("tipo" = ANY (ARRAY['rg'::"text", 'cpf'::"text", 'ctps'::"text", 'pis_pasep'::"text", 'titulo_eleitor'::"text", 'comprovante_residencia'::"text", 'foto_3x4'::"text", 'aso_admissional'::"text", 'reservista'::"text", 'certidao_nascimento'::"text", 'certidao_casamento'::"text", 'cnh'::"text", 'outros'::"text"])))
);


ALTER TABLE "public"."employee_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "nome" "text" NOT NULL,
    "sobrenome" "text" NOT NULL,
    "cpf" "text",
    "ctps" "text",
    "funcao" "text" NOT NULL,
    "salario_base" numeric(10,2) DEFAULT 0 NOT NULL,
    "data_admissao" "date" NOT NULL,
    "data_demissao" "date",
    "ativo" boolean DEFAULT true,
    "banco" "text",
    "agencia" "text",
    "conta" "text",
    "tipo_conta" "text",
    "pix" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rg" "text",
    "rg_orgao" "text",
    "rg_uf" character(2),
    "pis" "text",
    "ctps_serie" "text",
    "ctps_uf" character(2),
    "titulo_eleitor" "text",
    "reservista" "text",
    "rua" "text",
    "numero" "text",
    "complemento" "text",
    "bairro" "text",
    "cidade" "text",
    "estado" character(2),
    "cep" "text",
    "escolaridade" "text",
    "raca" "text",
    "genero" "text",
    "nome_mae" "text",
    "nome_pai" "text",
    "departamento" "text",
    "employee_code" "text",
    "esocial_code" "text",
    "nome_social" "text",
    "data_nascimento" "date",
    "cidade_nascimento" "text",
    "uf_nascimento" character(2),
    "pais_nascimento" "text" DEFAULT 'Brasil'::"text",
    "estado_civil" "text",
    "tipo_contrato" "text",
    "jornada" "text",
    "telefone" "text",
    "email" "text",
    "contato_emergencia_nome" "text",
    "contato_emergencia_tel" "text",
    "photo_url" "text",
    "ctps_expedicao" "date",
    "zona_eleitoral" "text",
    "secao_eleitoral" "text",
    "rne" "text",
    "rne_orgao" "text",
    "rne_expedicao" "date",
    "status_rh" "text" DEFAULT 'ativo'::"text",
    "score" integer DEFAULT 100 NOT NULL,
    "manager_id" "uuid",
    "mise_ativo" boolean DEFAULT false,
    "role_id" "uuid",
    "tier" "text",
    "observacao" "text",
    "push_token" "text",
    "push_token_updated_at" timestamp with time zone,
    CONSTRAINT "employees_status_rh_check" CHECK (("status_rh" = ANY (ARRAY['ativo'::"text", 'inativo'::"text", 'ferias'::"text", 'afastado'::"text"]))),
    CONSTRAINT "employees_tier_check" CHECK (("tier" = ANY (ARRAY['T1'::"text", 'T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"]))),
    CONSTRAINT "employees_tipo_contrato_check" CHECK (("tipo_contrato" = ANY (ARRAY['CLT'::"text", 'PJ'::"text", 'temporario'::"text", 'estagiario'::"text"])))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "tipo" "text",
    "storage_path" "text" NOT NULL,
    "tamanho_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_infra_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "categoria" "text" NOT NULL,
    "item" "text" NOT NULL,
    "quantidade" integer DEFAULT 1,
    "responsavel" "text",
    "status" "text" DEFAULT 'pendente'::"text",
    "observacoes" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_infra_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "categoria" "public"."menu_item_category" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "quantidade" integer,
    "unidade" "text",
    "preco_unitario" numeric(10,2),
    "observacoes" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "nome_externo" "text",
    "funcao" "text" NOT NULL,
    "horario_entrada" time without time zone,
    "horario_saida" time without time zone,
    "observacoes" "text",
    "confirmado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_status_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status_anterior" "public"."event_status",
    "status_novo" "public"."event_status" NOT NULL,
    "changed_by" "uuid",
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_status_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "text",
    "data_inicio" timestamp with time zone NOT NULL,
    "data_fim" timestamp with time zone,
    "num_convidados" integer,
    "responsavel_interno" "uuid",
    "contato_cliente" "text",
    "telefone_cliente" "text",
    "email_cliente" "text",
    "empresa_cliente" "text",
    "observacoes" "text",
    "status" "public"."event_status" DEFAULT 'rascunho'::"public"."event_status" NOT NULL,
    "valor_total" numeric(12,2),
    "valor_sinal" numeric(12,2),
    "valor_sinal_pago" boolean DEFAULT false,
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tema" "text",
    "hora_inicio" time without time zone,
    "hora_termino" time without time zone,
    "situacao_pagamento" "text",
    "responsavel_comercial" "text",
    "responsavel_operacional" "text",
    "briefing_cliente" "text",
    "espacos" "text",
    "acesso_entrada" "text",
    "acesso_obs" "text",
    "mobiliario" "text",
    "mobiliario_obs" "text",
    "fotografia" "text",
    "valet" "text",
    "artistico" "text",
    "gerador" "text",
    "ambulancia" "text",
    "menores" "text",
    "montagem" "text",
    "montagem_descricao" "text",
    "brigada" "jsonb",
    "menu_bar" "jsonb",
    "menu_cozinha" "jsonb",
    "campo_livre" "text",
    "tempos_movimentos" "text",
    "layout_anexos" "text",
    "criado_por" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "module" "text" NOT NULL,
    "description" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "feedback_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'triaged'::"text", 'resolved'::"text"]))),
    CONSTRAINT "feedback_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'suggestion'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedbacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "de_employee_id" "uuid" NOT NULL,
    "para_employee_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "anonimo" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_nao_proprio" CHECK (("de_employee_id" <> "para_employee_id")),
    CONSTRAINT "feedbacks_categoria_check" CHECK (("categoria" = ANY (ARRAY['atendimento'::"text", 'trabalho_em_equipe'::"text", 'lideranca'::"text", 'pontualidade'::"text", 'tecnico'::"text", 'comportamento'::"text", 'outro'::"text"]))),
    CONSTRAINT "feedbacks_tipo_check" CHECK (("tipo" = ANY (ARRAY['positivo'::"text", 'desenvolvimento'::"text"])))
);


ALTER TABLE "public"."feedbacks" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedbacks" IS 'Feedbacks positivos e de desenvolvimento entre colaboradores.';



CREATE TABLE IF NOT EXISTS "public"."financeiro_importacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "arquivo" "text" NOT NULL,
    "checksum_sha256" "text" NOT NULL,
    "storage_path" "text",
    "registros" integer DEFAULT 0 NOT NULL,
    "totais" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "avisos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'processando'::"text" NOT NULL,
    "erro" "text",
    "criado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concluido_em" timestamp with time zone,
    CONSTRAINT "financeiro_importacoes_status_check" CHECK (("status" = ANY (ARRAY['processando'::"text", 'concluido'::"text", 'erro'::"text"]))),
    CONSTRAINT "financeiro_importacoes_tipo_check" CHECK (("tipo" = ANY (ARRAY['nf_entrada'::"text", 'contas_pagar'::"text", 'receita'::"text", 'folha'::"text"])))
);


ALTER TABLE "public"."financeiro_importacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financeiro_revisoes" (
    "unit_id" "uuid" NOT NULL,
    "revisao" bigint DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."financeiro_revisoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folha_empresa" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "competencia" "text" NOT NULL,
    "etapa" "text" NOT NULL,
    "nome_chave" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "pagamento" numeric(14,2),
    "bonificacao" numeric(14,2),
    "fontes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "arquivo" "text" NOT NULL,
    "documento_path" "text",
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "folha_empresa_bonificacao_check" CHECK (("bonificacao" >= (0)::numeric)),
    CONSTRAINT "folha_empresa_check" CHECK ((("pagamento" IS NOT NULL) OR ("bonificacao" IS NOT NULL))),
    CONSTRAINT "folha_empresa_competencia_check" CHECK (("competencia" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'::"text")),
    CONSTRAINT "folha_empresa_etapa_check" CHECK (("etapa" = ANY (ARRAY['mensal'::"text", 'adiantamento'::"text"]))),
    CONSTRAINT "folha_empresa_nome_chave_check" CHECK (("length"(TRIM(BOTH FROM "nome_chave")) > 0)),
    CONSTRAINT "folha_empresa_nome_check" CHECK (("length"(TRIM(BOTH FROM "nome")) > 0)),
    CONSTRAINT "folha_empresa_pagamento_check" CHECK (("pagamento" >= (0)::numeric))
);


ALTER TABLE "public"."folha_empresa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fornecedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "cnpj" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fornecedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fornecedores_depara" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fornecedor_id" "uuid" NOT NULL,
    "nome_origem" "text" NOT NULL,
    "origem" "text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nome_origem_literal" "text" NOT NULL,
    CONSTRAINT "fornecedores_depara_origem_check" CHECK (("origem" = ANY (ARRAY['nfe'::"text", 'titulo'::"text"])))
);


ALTER TABLE "public"."fornecedores_depara" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gorjeta_cargo_pontos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "cargo" "text" NOT NULL,
    "pontos" integer NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gorjeta_cargo_pontos_pontos_check" CHECK (("pontos" >= 0))
);


ALTER TABLE "public"."gorjeta_cargo_pontos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gorjeta_dias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "periodo_id" "uuid",
    "data" "date" NOT NULL,
    "cargo" "text" NOT NULL,
    "pontos" integer DEFAULT 0 NOT NULL,
    "presente" boolean DEFAULT true NOT NULL,
    "valor_calculado" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gorjeta_dias_pontos_check" CHECK (("pontos" >= 0))
);


ALTER TABLE "public"."gorjeta_dias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gorjeta_distribuicao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "mes" smallint NOT NULL,
    "ano" smallint NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cargo" "text" NOT NULL,
    "dias_trabalhados" integer NOT NULL,
    "pontuacao" numeric(10,4) NOT NULL,
    "percentual" numeric(10,8) DEFAULT 0 NOT NULL,
    "valor_bruto" numeric(12,2) DEFAULT 0 NOT NULL,
    "valor_liquido" numeric(12,2) DEFAULT 0 NOT NULL,
    "recibo_gerado_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recibo_url" "text",
    "periodo" "text",
    "colaborador_id" "uuid",
    CONSTRAINT "gorjeta_distribuicao_ano_check" CHECK (("ano" >= 2024)),
    CONSTRAINT "gorjeta_distribuicao_mes_check" CHECK ((("mes" >= 1) AND ("mes" <= 12)))
);


ALTER TABLE "public"."gorjeta_distribuicao" OWNER TO "postgres";


COMMENT ON COLUMN "public"."gorjeta_distribuicao"."recibo_url" IS 'LGPD: armazenar apenas storage path — não URL pública permanente. Gerar signed URL on-demand via createSignedUrl.';



CREATE TABLE IF NOT EXISTS "public"."gorjeta_periodos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "data" "date" NOT NULL,
    "receita_bruta" numeric(12,2) NOT NULL,
    "imposto_pct" numeric(5,2) DEFAULT 20.00 NOT NULL,
    "receita_liquida" numeric(12,2) GENERATED ALWAYS AS ("round"(("receita_bruta" * ((1)::numeric - ("imposto_pct" / 100.0))), 2)) STORED,
    "total_pontos" integer NOT NULL,
    "valor_ponto" numeric(10,4) GENERATED ALWAYS AS ("round"((("receita_bruta" * ((1)::numeric - ("imposto_pct" / 100.0))) / ("total_pontos")::numeric), 4)) STORED,
    "fonte" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gorjeta_periodos_fonte_check" CHECK (("fonte" = ANY (ARRAY['manual'::"text", 'lorean'::"text", 'import'::"text"]))),
    CONSTRAINT "gorjeta_periodos_imposto_pct_check" CHECK ((("imposto_pct" >= (0)::numeric) AND ("imposto_pct" <= (100)::numeric))),
    CONSTRAINT "gorjeta_periodos_receita_bruta_check" CHECK (("receita_bruta" >= (0)::numeric)),
    CONSTRAINT "gorjeta_periodos_total_pontos_check" CHECK (("total_pontos" > 0))
);


ALTER TABLE "public"."gorjeta_periodos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "icone" "text",
    "parent_id" "uuid"
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hos_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "user_id" "uuid",
    "decision" "text" NOT NULL,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "hos_approvals_decision_check" CHECK (("decision" = ANY (ARRAY['approve'::"text", 'reject'::"text"])))
);


ALTER TABLE "public"."hos_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hos_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "report_md" "text" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hos_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hos_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auto_approve" boolean DEFAULT false NOT NULL,
    "unit_id" "uuid",
    "funcao" "text",
    "descricao" "text"
);


ALTER TABLE "public"."hos_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hos_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "triggered_by" "text" DEFAULT 'webhook'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "logs" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone,
    "deployment_id" "text",
    "title" "text",
    "employee_id" "uuid",
    "result_data" "jsonb",
    CONSTRAINT "hos_runs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'awaiting_approval'::"text", 'approved'::"text", 'rejected'::"text", 'failed'::"text"]))),
    CONSTRAINT "hos_runs_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['webhook'::"text", 'cron'::"text", 'discord'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."hos_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hour_bank" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "competencia" "date",
    "horas_extras" numeric(6,2),
    "horas_debito" numeric(6,2),
    "saldo" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hour_bank" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hr_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "nome" "text" NOT NULL,
    "tipo" "text",
    "descricao" "text",
    "valor" numeric(10,2),
    "dia_pagamento" integer,
    "condicoes" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hr_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "periodo" "text" NOT NULL,
    "tipo" "text" DEFAULT 'ponto'::"text",
    "total_linhas" integer DEFAULT 0,
    "importados" integer DEFAULT 0,
    "nao_encontrados" integer DEFAULT 0,
    "erros" integer DEFAULT 0,
    "detalhes" "jsonb",
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "import_logs_tipo_check" CHECK (("tipo" = ANY (ARRAY['ponto'::"text", 'holerites'::"text", 'gorjetas'::"text", 'vt'::"text", 'purchase_invoices'::"text"])))
);


ALTER TABLE "public"."import_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "custo_anterior" numeric(12,4),
    "custo_novo" numeric(12,4) NOT NULL,
    "motivo" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ingredient_price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "estoque_minimo" numeric DEFAULT 0 NOT NULL,
    "estoque_real" numeric DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingredient_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "codigo" "text",
    "nome" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "unidade_padrao" "text" NOT NULL,
    "custo_padrao" numeric(12,4) DEFAULT 0 NOT NULL,
    "fornecedor_id" "uuid",
    "perdas_padrao" numeric(5,2) DEFAULT 0,
    "observacoes" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "categoria_anvisa" "text",
    "menu_item_id" "uuid",
    CONSTRAINT "ingredients_categoria_check" CHECK (("categoria" = ANY (ARRAY['proteina'::"text", 'verdura'::"text", 'legume'::"text", 'fruta'::"text", 'graos'::"text", 'laticinios'::"text", 'panificacao'::"text", 'bebida_alcoolica'::"text", 'bebida_nao_alcoolica'::"text", 'tempero'::"text", 'oleo_gordura'::"text", 'descartavel'::"text", 'limpeza'::"text", 'outro'::"text"]))),
    CONSTRAINT "ingredients_unidade_padrao_check" CHECK (("unidade_padrao" = ANY (ARRAY['kg'::"text", 'g'::"text", 'l'::"text", 'ml'::"text", 'un'::"text", 'cx'::"text", 'fardo'::"text", 'duzia'::"text"])))
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ingredients"."menu_item_id" IS 'Quando o insumo também tem ficha própria (subproduto/produto usado como componente), aponta para ela. Permite drill-down no BOM.';



CREATE TABLE IF NOT EXISTS "public"."interview_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_opening_id" "uuid" NOT NULL,
    "order_num" integer NOT NULL,
    "question_text" "text",
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."interview_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interview_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."interview_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "job_opening_id" "uuid",
    "entrevistador_id" "uuid",
    "data_entrevista" timestamp with time zone NOT NULL,
    "formato" "text" DEFAULT 'presencial'::"text" NOT NULL,
    "status" "text" DEFAULT 'agendada'::"text" NOT NULL,
    "feedback" "text",
    "nota" numeric(3,1),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "interviews_formato_check" CHECK (("formato" = ANY (ARRAY['presencial'::"text", 'video'::"text", 'telefone'::"text"]))),
    CONSTRAINT "interviews_nota_check" CHECK ((("nota" >= (0)::numeric) AND ("nota" <= (10)::numeric))),
    CONSTRAINT "interviews_status_check" CHECK (("status" = ANY (ARRAY['agendada'::"text", 'realizada'::"text", 'cancelada'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."interviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."interviews" IS 'Entrevistas agendadas com candidatos.';



CREATE TABLE IF NOT EXISTS "public"."job_descriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cargo" "text" NOT NULL,
    "area" "text" NOT NULL,
    "responsabilidades" "text",
    "requisitos" "text",
    "beneficios" "text",
    "brand_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "tipo_contrato" "text" DEFAULT 'clt'::"text" NOT NULL,
    "modalidade" "text" DEFAULT 'presencial'::"text" NOT NULL,
    "reporte_direto" "text",
    "objetivo_cargo" "text",
    "resp_gestao_operacional" "text",
    "resp_gestao_pessoas" "text",
    "resp_estoque_custos" "text",
    "resp_qualidade_experiencia" "text",
    "indicadores_performance" "text",
    "req_formacao" "text",
    "req_experiencia" "text",
    "req_conhecimentos_tecnicos" "text",
    "req_competencias_comportamentais" "text",
    "responsabilidades_sobre_pessoas" "text",
    "condicoes_trabalho" "text",
    "indicadores_sucesso" "text",
    "cargo_id" "uuid",
    CONSTRAINT "job_descriptions_modalidade_check" CHECK (("modalidade" = ANY (ARRAY['presencial'::"text", 'hibrido'::"text", 'remoto'::"text"]))),
    CONSTRAINT "job_descriptions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "job_descriptions_tipo_contrato_check" CHECK (("tipo_contrato" = ANY (ARRAY['clt'::"text", 'pj'::"text", 'estagio'::"text", 'temporario'::"text", 'intermitente'::"text"])))
);


ALTER TABLE "public"."job_descriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_opening_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opening_id" "uuid",
    "texto" "text" NOT NULL,
    "autor" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_opening_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_openings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "unit_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'aberta'::"text" NOT NULL,
    "recrutador" "text",
    "sla_dias" integer DEFAULT 30,
    "status_prazo" "text",
    "motivo" "text",
    "horario" "text",
    "salario" numeric(10,2),
    "fonte_recrutamento" "text",
    "data_admissao" "date",
    "candidato_aprovado" "text",
    "fechamento_previsto" "date",
    "observacoes" "text",
    "area" "text",
    "cargo" "text",
    "data_solicitacao" "date",
    "observacao" "text",
    "responsavel_id" "uuid",
    "entrevistador_id" "uuid",
    "prioridade" "text" DEFAULT 'media'::"text",
    "salario_min" numeric(10,2),
    "salario_max" numeric(10,2),
    "must_have" "text",
    "nice_to_have" "text",
    "cargo_grupo_id" "uuid",
    "motivo_estruturado" "text",
    "horario_escala" "text",
    "forma_contratacao" "text",
    "substituido_id" "uuid",
    "periodo_exp_dias" integer DEFAULT 90,
    "congelada" boolean DEFAULT false NOT NULL,
    "cancelada" boolean DEFAULT false NOT NULL,
    "motivo_congelamento" "text",
    "congelada_em" timestamp with time zone,
    "cancelada_em" timestamp with time zone,
    CONSTRAINT "job_openings_forma_contratacao_check" CHECK ((("forma_contratacao" IS NULL) OR ("forma_contratacao" = ANY (ARRAY['CLT'::"text", 'PJ'::"text", 'freelance'::"text", 'temporario'::"text", 'estagio'::"text"])))),
    CONSTRAINT "job_openings_motivo_estruturado_check" CHECK ((("motivo_estruturado" IS NULL) OR ("motivo_estruturado" = ANY (ARRAY['abertura_casa'::"text", 'aumento_quadro'::"text", 'adequacao_quadro'::"text", 'substituicao_desligamento'::"text", 'substituicao_promocao'::"text", 'substituicao_licenca'::"text"])))),
    CONSTRAINT "job_openings_prioridade_check" CHECK (("prioridade" = ANY (ARRAY['alta'::"text", 'media'::"text", 'baixa'::"text"]))),
    CONSTRAINT "job_openings_status_prazo_check" CHECK (("status_prazo" = ANY (ARRAY['no_prazo'::"text", 'atencao'::"text", 'atrasado'::"text", 'congelada'::"text"])))
);


ALTER TABLE "public"."job_openings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."job_openings"."motivo_estruturado" IS '6 motivos canônicos KPH (ver CHECK). Campo motivo (text) preservado para notas livres legadas.';



CREATE TABLE IF NOT EXISTS "public"."job_requisitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending_hr_review'::"text" NOT NULL,
    "area" "text",
    "cargo" "text",
    "motivo" "text",
    "data_limite" "date",
    "resumo_responsabilidades" "text",
    "desafios_reais" "text",
    "hard_skills_obrigatorios" "text",
    "hard_skills_desejaveis" "text",
    "soft_skills" "text",
    "fatores_eliminatorios" "text",
    "cenario_pratico" "text",
    "gabarito_rh" "text",
    "proposta_valor" "text",
    "justificativa_vaga" "text",
    "nome_solicitante" "text",
    "vale_transporte" "text",
    "empresa" "text"
);


ALTER TABLE "public"."job_requisitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kph_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "prioridade" "text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "entidade" "text",
    "entidade_id" "uuid",
    "enviado_para" "text"[],
    "canal" "text" DEFAULT 'whatsapp'::"text",
    "enviado_em" timestamp with time zone,
    "lido" boolean DEFAULT false,
    "resolvido" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kph_alerts_prioridade_check" CHECK (("prioridade" = ANY (ARRAY['P0'::"text", 'P1'::"text", 'P2'::"text", 'P3'::"text"])))
);


ALTER TABLE "public"."kph_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kph_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modulo" "text" NOT NULL,
    "semana" "date" NOT NULL,
    "insight_text" "text" NOT NULL,
    "dados_referencia" "jsonb",
    "gerado_por" "text" DEFAULT 'claude-sonnet-4-6'::"text",
    "aprovado" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kph_insights_modulo_check" CHECK (("modulo" = ANY (ARRAY['wbr'::"text", 'metas'::"text", 'cross'::"text", 'adocao'::"text", 'orquestrador'::"text", 'geral'::"text", 'pessoas'::"text", 'financeiro'::"text", 'operacao'::"text", 'compras'::"text", 'comercial'::"text", 'marca'::"text"])))
);


ALTER TABLE "public"."kph_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kph_intelligence_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "semana" "date" NOT NULL,
    "score" integer NOT NULL,
    "cmv_score" integer,
    "ebitda_score" integer,
    "metas_score" integer,
    "adocao_score" integer,
    "bugs_score" integer,
    "breakdown" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modulo" "text",
    "score_oficial" integer,
    "cap_razao" "text",
    CONSTRAINT "kph_intelligence_scores_adocao_score_check" CHECK ((("adocao_score" >= 0) AND ("adocao_score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_bugs_score_check" CHECK ((("bugs_score" >= 0) AND ("bugs_score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_cmv_score_check" CHECK ((("cmv_score" >= 0) AND ("cmv_score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_ebitda_score_check" CHECK ((("ebitda_score" >= 0) AND ("ebitda_score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_metas_score_check" CHECK ((("metas_score" >= 0) AND ("metas_score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_score_check" CHECK ((("score" >= 0) AND ("score" <= 100))),
    CONSTRAINT "kph_intelligence_scores_score_oficial_check" CHECK ((("score_oficial" IS NULL) OR (("score_oficial" >= 0) AND ("score_oficial" <= 100))))
);


ALTER TABLE "public"."kph_intelligence_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kph_learning_proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "modulo" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "prioridade" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "evidencia" "text",
    "impacto_estimado" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "executed_at" timestamp with time zone,
    "severidade" "text",
    CONSTRAINT "kph_learning_proposals_prioridade_check" CHECK (("prioridade" = ANY (ARRAY['alta'::"text", 'media'::"text", 'baixa'::"text"]))),
    CONSTRAINT "kph_learning_proposals_severidade_check" CHECK ((("severidade" IS NULL) OR ("severidade" = ANY (ARRAY['CRITICO'::"text", 'ALTO'::"text", 'MEDIO'::"text", 'BAIXO'::"text"])))),
    CONSTRAINT "kph_learning_proposals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "kph_learning_proposals_tipo_check" CHECK (("tipo" = ANY (ARRAY['faq'::"text", 'prompt'::"text", 'processo'::"text", 'integracao'::"text"])))
);


ALTER TABLE "public"."kph_learning_proposals" OWNER TO "postgres";


COMMENT ON TABLE "public"."kph_learning_proposals" IS 'Propostas de melhoria geradas pelo Learning Machine por módulo do KPH OS.';



COMMENT ON COLUMN "public"."kph_learning_proposals"."modulo" IS 'Módulo de origem: pessoas | operacao | financeiro';



COMMENT ON COLUMN "public"."kph_learning_proposals"."tipo" IS 'Tipo de proposta: faq | prompt | processo | integracao';



COMMENT ON COLUMN "public"."kph_learning_proposals"."prioridade" IS 'Prioridade: alta | media | baixa';



COMMENT ON COLUMN "public"."kph_learning_proposals"."evidencia" IS 'Dado ou métrica que sustenta a proposta (ex: "23% de turnover no mês")';



COMMENT ON COLUMN "public"."kph_learning_proposals"."impacto_estimado" IS 'Efeito esperado se a proposta for implementada';



COMMENT ON COLUMN "public"."kph_learning_proposals"."status" IS 'pending = aguardando decisão | approved = aprovado | dismissed = descartado';



COMMENT ON COLUMN "public"."kph_learning_proposals"."executed_at" IS 'Timestamp de quando a proposta foi aprovada ou descartada';



CREATE TABLE IF NOT EXISTS "public"."kpi_snapshot" (
    "unit_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "receita_bruta" numeric(16,2),
    "receita_liquida" numeric(16,2),
    "cmv_compras" numeric(16,2),
    "mao_de_obra" numeric(16,2),
    "despesas_operacionais" numeric(16,2),
    "ebitda" numeric(16,2),
    "cmv_compras_pct" numeric(8,4),
    "mo_pct" numeric(8,4),
    "prime_cost_pct" numeric(8,4),
    "ebitda_pct" numeric(8,4),
    "clientes" integer,
    "ticket_medio" numeric(12,2),
    "cmv_por_cliente" numeric(12,2),
    "tem_nfe" boolean DEFAULT false NOT NULL,
    "pct_classificado" numeric(8,4),
    "fontes_ok" integer,
    "fontes_total" integer,
    "confianca_pct" numeric(8,4),
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "possivel_dupla_contagem" numeric(16,2),
    "tem_folha" boolean DEFAULT false NOT NULL,
    "resultado_liquido" numeric,
    "pct_compra_com_xml" numeric,
    "revisao_fonte" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."kpi_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lancamentos" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "competencia" "date" NOT NULL,
    "conta_codigo" "text" NOT NULL,
    "valor" numeric(16,2) NOT NULL,
    "origem" "text" NOT NULL,
    "origem_id" "text" NOT NULL,
    "descricao" "text",
    "fornecedor_cnpj" "text",
    "fornecedor_nome" "text",
    "produto_id" "uuid",
    "reconciliado" boolean DEFAULT false NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lancamentos_origem_check" CHECK (("origem" = ANY (ARRAY['nfe_entrada'::"text", 'titulo'::"text", 'folha'::"text", 'receita'::"text", 'inventario'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."lancamentos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lancamentos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lancamentos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lancamentos_id_seq" OWNED BY "public"."lancamentos"."id";



CREATE TABLE IF NOT EXISTS "public"."learning_machine_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_number" integer NOT NULL,
    "year" integer NOT NULL,
    "total_runs" integer DEFAULT 0 NOT NULL,
    "active_agents" integer DEFAULT 0 NOT NULL,
    "inactive_agents" integer DEFAULT 0 NOT NULL,
    "top_agents" "jsonb",
    "dormant_agents" "jsonb",
    "missing_agents" "jsonb",
    "insights" "jsonb",
    "raw_analysis" "text",
    "generated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."learning_machine_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_cancelamentos_detalhe" (
    "id" bigint NOT NULL,
    "workday_id_fk" "uuid" NOT NULL,
    "item" "text",
    "usuario" "text",
    "motivo" "text",
    "qtd" numeric,
    "valor" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_cancelamentos_detalhe" OWNER TO "postgres";


ALTER TABLE "public"."receita_cancelamentos_detalhe" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."lorean_cancelamentos_detalhe_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."receita_descontos_detalhe" (
    "id" bigint NOT NULL,
    "workday_id_fk" "uuid" NOT NULL,
    "item" "text",
    "usuario" "text",
    "motivo" "text",
    "qtd" numeric,
    "valor" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_descontos_detalhe" OWNER TO "postgres";


ALTER TABLE "public"."receita_descontos_detalhe" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."lorean_descontos_detalhe_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."receita_produtos_dia" (
    "id" bigint NOT NULL,
    "workday_id_fk" "uuid" NOT NULL,
    "grupo" "text",
    "produto" "text" NOT NULL,
    "qtd" numeric,
    "cmv_pct" numeric,
    "bruto" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "total" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_produtos_dia" OWNER TO "postgres";


ALTER TABLE "public"."receita_produtos_dia" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."lorean_produtos_dia_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."manutencao_aprovacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "chamado_id" "uuid",
    "operacao" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "local" "text" NOT NULL,
    "andar" "text",
    "prioridade" "text" DEFAULT 'P.3'::"text" NOT NULL,
    "servico" "text" NOT NULL,
    "data_solicitacao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valor_previsto" numeric DEFAULT 0 NOT NULL,
    "forma_pagamento" "text",
    "numero_parcelas" integer DEFAULT 1 NOT NULL,
    "valor_parcela" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("numero_parcelas" > 0) THEN ("valor_previsto" / ("numero_parcelas")::numeric)
    ELSE (0)::numeric
END) STORED,
    "aprovado" "text" DEFAULT 'PENDENTE'::"text" NOT NULL,
    "data_aprovacao" "date",
    "aprovado_por" "uuid",
    "data_execucao" "date",
    "garantia_dias" integer,
    "data_vence_garantia" "date" GENERATED ALWAYS AS (
CASE
    WHEN (("garantia_dias" IS NOT NULL) AND ("data_execucao" IS NOT NULL)) THEN ("data_execucao" + "garantia_dias")
    ELSE NULL::"date"
END) STORED,
    "numero_nota_fiscal" "text",
    "observacoes" "text",
    "criado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "manutencao_aprovacoes_aprovado_check" CHECK (("aprovado" = ANY (ARRAY['SIM'::"text", 'NAO'::"text", 'PENDENTE'::"text"]))),
    CONSTRAINT "manutencao_aprovacoes_numero_parcelas_check" CHECK (("numero_parcelas" >= 1))
);


ALTER TABLE "public"."manutencao_aprovacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manutencao_chamados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "operacao" "text" NOT NULL,
    "categoria" "text" NOT NULL,
    "local" "text" NOT NULL,
    "andar" "text",
    "prioridade" "text" DEFAULT 'P.3'::"text" NOT NULL,
    "servico" "text" NOT NULL,
    "motivo" "text",
    "data_solicitacao" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_execucao" "date",
    "executado_por" "text",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "valor_previsto" numeric,
    "observacoes" "text",
    "criado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "manutencao_chamados_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'em_andamento'::"text", 'em_aprovacao'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."manutencao_chamados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manutencao_parcelas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "aprovacao_id" "uuid" NOT NULL,
    "numero" integer NOT NULL,
    "competencia" "date" NOT NULL,
    "valor" numeric DEFAULT 0 NOT NULL,
    "pago" boolean DEFAULT false NOT NULL,
    "data_pagamento" "date",
    "comprovante_url" "text",
    "comprovante_nome" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."manutencao_parcelas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mapa_conta_dre" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "descricao_c_gerencial" "text" NOT NULL,
    "linha_dre" "text",
    "esperada_mensal" boolean DEFAULT false,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "atualizado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mapa_conta_dre" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "categoria" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "preco_venda" numeric(12,2) DEFAULT 0 NOT NULL,
    "custo_total" numeric(12,4) DEFAULT 0 NOT NULL,
    "tem_ficha_tecnica" boolean DEFAULT false,
    "ativo" boolean DEFAULT true,
    "observacoes" "text",
    "ordem" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "codigo" "text",
    "rendimento" numeric(14,6) DEFAULT 1 NOT NULL,
    "is_subproduto" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."menu_items"."codigo" IS 'Código do item no Everest (4xxxxxx acabado, 5xxxxxx subproduto). Chave do upsert semanal.';



COMMENT ON COLUMN "public"."menu_items"."rendimento" IS 'Q. Produção da ficha. Subprodutos rendem > 1.';



COMMENT ON COLUMN "public"."menu_items"."is_subproduto" IS 'true = preparo intermediário (tem ficha própria mas não é vendido isolado).';



CREATE TABLE IF NOT EXISTS "public"."metas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "chave" "text" NOT NULL,
    "valor" numeric(16,4) NOT NULL,
    "tipo" "text" NOT NULL,
    "origem" "text" DEFAULT 'baseline'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "metas_origem_check" CHECK (("origem" = ANY (ARRAY['baseline'::"text", 'manual'::"text"]))),
    CONSTRAINT "metas_tipo_check" CHECK (("tipo" = ANY (ARRAY['absoluto'::"text", 'pct_receita_liquida'::"text"])))
);


ALTER TABLE "public"."metas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metas_dia_override" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "meta" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metas_dia_override" OWNER TO "postgres";


ALTER TABLE "public"."metas_dia_override" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."metas_dia_override_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."metas_dia_semana" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "dia_semana" integer NOT NULL,
    "meta" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "metas_dia_semana_dia_semana_check" CHECK ((("dia_semana" >= 0) AND ("dia_semana" <= 6)))
);


ALTER TABLE "public"."metas_dia_semana" OWNER TO "postgres";


ALTER TABLE "public"."metas_dia_semana" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."metas_dia_semana_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."metas_projecoes" (
    "id" integer NOT NULL,
    "mes_ano" "text" NOT NULL,
    "meta_faturamento" numeric,
    "metas_diarias" "jsonb",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."metas_projecoes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."metas_projecoes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."metas_projecoes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."metas_projecoes_id_seq" OWNED BY "public"."metas_projecoes"."id";



CREATE TABLE IF NOT EXISTS "public"."movimentacoes_caixa" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "conta_id" "uuid",
    "data" "date" NOT NULL,
    "tipo" "text" NOT NULL,
    "valor" numeric(16,2) NOT NULL,
    "descricao" "text",
    "origem" "text" NOT NULL,
    "origem_id" "text",
    "conta_codigo" "text",
    "conciliado" boolean DEFAULT false NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimentacoes_caixa_origem_check" CHECK (("origem" = ANY (ARRAY['extrato'::"text", 'titulo'::"text", 'receita'::"text", 'manual'::"text"]))),
    CONSTRAINT "movimentacoes_caixa_tipo_check" CHECK (("tipo" = ANY (ARRAY['entrada'::"text", 'saida'::"text"])))
);


ALTER TABLE "public"."movimentacoes_caixa" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."movimentacoes_caixa_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."movimentacoes_caixa_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."movimentacoes_caixa_id_seq" OWNED BY "public"."movimentacoes_caixa"."id";



CREATE TABLE IF NOT EXISTS "public"."movimentacoes_rh" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "data_movimentacao" "date" NOT NULL,
    "unidade_id" "uuid",
    "unidade_destino_id" "uuid",
    "funcao_antes" "text",
    "funcao_depois" "text",
    "tier_antes" "text",
    "tier_depois" "text",
    "motivo" "text",
    "registrado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "movimentacoes_rh_tipo_check" CHECK (("tipo" = ANY (ARRAY['admissao'::"text", 'demissao'::"text", 'transferencia'::"text", 'promocao'::"text"])))
);


ALTER TABLE "public"."movimentacoes_rh" OWNER TO "postgres";


COMMENT ON TABLE "public"."movimentacoes_rh" IS 'Registro canônico de movimentações de RH — admissões, demissões, transferências e promoções.
   Populado inicialmente por migration a partir de employees.data_admissao/data_demissao.';



CREATE TABLE IF NOT EXISTS "public"."nfe_documentos" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "importacao_id" "uuid",
    "chave" "text" NOT NULL,
    "direcao" "text" NOT NULL,
    "numero" "text",
    "serie" "text",
    "emissao" timestamp with time zone NOT NULL,
    "emitente_cnpj" "text",
    "emitente_nome" "text",
    "destinatario_cnpj" "text",
    "destinatario_nome" "text",
    "valor_total" numeric(16,2) DEFAULT 0 NOT NULL,
    "status_sefaz" "text",
    "cancelada" boolean DEFAULT false NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "xml_original" "text",
    "xml_cancelamento" "text",
    CONSTRAINT "nfe_documentos_direcao_check" CHECK (("direcao" = ANY (ARRAY['entrada'::"text", 'saida'::"text"])))
);


ALTER TABLE "public"."nfe_documentos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."nfe_documentos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."nfe_documentos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."nfe_documentos_id_seq" OWNED BY "public"."nfe_documentos"."id";



CREATE TABLE IF NOT EXISTS "public"."nfe_importacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "arquivo" "text" NOT NULL,
    "direcao" "text" NOT NULL,
    "total_xml" integer DEFAULT 0 NOT NULL,
    "importadas" integer DEFAULT 0 NOT NULL,
    "duplicadas" integer DEFAULT 0 NOT NULL,
    "canceladas" integer DEFAULT 0 NOT NULL,
    "rejeitadas" integer DEFAULT 0 NOT NULL,
    "valor_total" numeric(16,2) DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nfe_importacoes_direcao_check" CHECK (("direcao" = ANY (ARRAY['entrada'::"text", 'saida'::"text"])))
);


ALTER TABLE "public"."nfe_importacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notas_detalhadas" (
    "id" integer NOT NULL,
    "local" "text",
    "topico" "text",
    "setor" "text",
    "data_inspecao" "date" NOT NULL,
    "meta" numeric,
    "nota" numeric
);


ALTER TABLE "public"."notas_detalhadas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notas_detalhadas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_detalhadas_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_detalhadas_id_seq" OWNED BY "public"."notas_detalhadas"."id";



CREATE TABLE IF NOT EXISTS "public"."notas_nutri" (
    "id" integer NOT NULL,
    "data_inspecao" "date" NOT NULL,
    "local" "text",
    "tipo_inspecao" "text",
    "nota" numeric,
    "status" "text"
);


ALTER TABLE "public"."notas_nutri" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notas_nutri_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notas_nutri_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notas_nutri_id_seq" OWNED BY "public"."notas_nutri"."id";



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "mensagem" "text",
    "link" "text",
    "lida" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occupational_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "cpf" "text",
    "cargo" "text",
    "tipo_exame" "text",
    "data_exame" "date",
    "resultado" "text",
    "restricoes" "text",
    "medico" "text",
    "crm" "text",
    "validade" "date",
    "documento_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."occupational_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid" NOT NULL,
    "tarefa_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "concluido_em" timestamp with time zone,
    "concluido_por" "uuid",
    CONSTRAINT "onboarding_checklist_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'concluido'::"text", 'ignorado'::"text"])))
);


ALTER TABLE "public"."onboarding_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'em_andamento'::"text" NOT NULL,
    "data_inicio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "onboarding_runs_status_check" CHECK (("status" = ANY (ARRAY['em_andamento'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."onboarding_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."onboarding_runs" IS 'Execuções de onboarding vinculadas a colaboradores admitidos.';



CREATE TABLE IF NOT EXISTS "public"."onboarding_tarefas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "responsavel" "text" NOT NULL,
    "prazo_dias" integer DEFAULT 1 NOT NULL,
    "ordem" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "onboarding_tarefas_responsavel_check" CHECK (("responsavel" = ANY (ARRAY['rh'::"text", 'gestor'::"text", 'colaborador'::"text", 'ti'::"text"])))
);


ALTER TABLE "public"."onboarding_tarefas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "descricao" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."onboarding_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."origens_candidato" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "label" "text" NOT NULL,
    "automatica" boolean DEFAULT false NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "ordem" integer DEFAULT 99 NOT NULL
);


ALTER TABLE "public"."origens_candidato" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orkestri_achados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "run_id" "text",
    "auditor" "text" NOT NULL,
    "zona" "text" NOT NULL,
    "marca" "text" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "periodo" "text" NOT NULL,
    "tipo_periodo" "text" DEFAULT 'mensal'::"text" NOT NULL,
    "indicador" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "severidade" "text",
    "r_em_risco" numeric(14,2),
    "desvio_pp" numeric(8,2),
    "realizado" numeric(8,2),
    "meta_interna" numeric(8,2),
    "faixa_mercado" "text",
    "titulo" "text" NOT NULL,
    "causa_provavel" "text",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "resolucao" "text",
    "fonte_ok" boolean DEFAULT true NOT NULL,
    "detalhe" "jsonb",
    "por_que_importa" "text",
    "acao_sugerida" "text",
    "dono_sugerido" "text",
    CONSTRAINT "oa_faixa_chk" CHECK ((("faixa_mercado" = ANY (ARRAY['VERDE'::"text", 'AMARELO'::"text", 'VERMELHO'::"text"])) OR ("faixa_mercado" IS NULL))),
    CONSTRAINT "oa_severidade_chk" CHECK ((("severidade" = ANY (ARRAY['critico'::"text", 'alerta'::"text", 'atencao'::"text"])) OR ("severidade" IS NULL))),
    CONSTRAINT "oa_status_chk" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'em_tratamento'::"text", 'resolvido'::"text", 'ignorado'::"text"]))),
    CONSTRAINT "oa_tipo_chk" CHECK (("tipo" = ANY (ARRAY['alerta'::"text", 'destaque'::"text", 'em_aberto'::"text"]))),
    CONSTRAINT "oa_tipo_periodo_chk" CHECK (("tipo_periodo" = ANY (ARRAY['mensal'::"text", 'semanal'::"text", 'diario'::"text", 'trimestral'::"text"])))
);


ALTER TABLE "public"."orkestri_achados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orkestri_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "nome" "text" NOT NULL,
    "empresa" "text" NOT NULL,
    "cargo" "text" NOT NULL,
    "email" "text" NOT NULL,
    "celular" "text" NOT NULL,
    "dor" "text",
    "problema_1" "text",
    "problema_2" "text",
    "problema_3" "text"
);


ALTER TABLE "public"."orkestri_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orquestrador_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payload" "jsonb",
    "result" "jsonb",
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "executed_at" timestamp with time zone,
    "execution_result" "jsonb",
    CONSTRAINT "orquestrador_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'success'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."orquestrador_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."overtime_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "hours" numeric(5,2) NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text",
    "approved" boolean,
    "approved_by" "uuid",
    "periodo" "text",
    "source" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "overtime_records_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'totvs'::"text"]))),
    CONSTRAINT "overtime_records_type_check" CHECK (("type" = ANY (ARRAY['50'::"text", '100'::"text", 'banco'::"text"])))
);


ALTER TABLE "public"."overtime_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "path" "text" NOT NULL,
    "visited_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."page_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_dominio_cadastro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cod_empresa" "text" NOT NULL,
    "cod_colaborador" integer NOT NULL,
    "nome" "text" NOT NULL,
    "nome_norm" "text" NOT NULL,
    "cargo_codigo" integer,
    "cargo_nome" "text",
    "data_admissao" "date",
    "salario" numeric(12,2),
    "cpf" "text",
    "employee_id" "uuid",
    "origem_match" "text",
    "vigente_desde" "date" DEFAULT '2026-07-01'::"date" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payroll_dominio_cadastro" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_dominio_cadastro" IS 'Cadastro de colaboradores no Dominio por empresa. Fonte do codigo de exportacao do TXT.';



COMMENT ON COLUMN "public"."payroll_dominio_cadastro"."origem_match" IS 'Como o employee_id foi resolvido: EXTRATO_CPF, NOME_DIRETO ou null (pendente).';



CREATE TABLE IF NOT EXISTS "public"."payroll_dominio_cargo" (
    "cargo_codigo" integer NOT NULL,
    "cargo_nome" "text" NOT NULL,
    "cbo" "text",
    "cargo_kph_id" "uuid",
    "observacao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payroll_dominio_cargo" OWNER TO "postgres";


COMMENT ON COLUMN "public"."payroll_dominio_cargo"."cargo_kph_id" IS 'FK opcional para o cargo canonico KPH. Preenchida no sprint de de-para de cargos.';



CREATE TABLE IF NOT EXISTS "public"."payroll_dominio_empresa" (
    "cod_empresa" "text" NOT NULL,
    "razao_social" "text" NOT NULL,
    "cnpj" "text",
    "ativa" boolean DEFAULT true NOT NULL,
    "observacao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payroll_dominio_empresa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_extrato_dominio_colaborador" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competencia" "text" NOT NULL,
    "cod_empresa_dominio" "text" NOT NULL,
    "cnpj" "text" NOT NULL,
    "cod_colaborador" integer NOT NULL,
    "nome" "text" NOT NULL,
    "cpf" "text" NOT NULL,
    "situacao" "text",
    "data_admissao" "date",
    "data_demissao" "date",
    "motivo_demissao" "text",
    "vinculo" "text",
    "centro_custo" integer,
    "departamento" integer,
    "cargo_codigo" integer,
    "cargo_nome" "text",
    "cbo" "text",
    "salario" numeric(12,2),
    "proventos" numeric(12,2),
    "descontos" numeric(12,2),
    "liquido" numeric(12,2),
    "base_inss" numeric(12,2),
    "base_fgts" numeric(12,2),
    "valor_fgts" numeric(12,2),
    "base_irrf" numeric(12,2),
    "employee_id" "uuid",
    "unit_id" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payroll_extrato_dominio_colaborador" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_extrato_dominio_colaborador" IS 'Espelho do extrato mensal do Dominio. Referencia de conferencia e fonte de backfill de cadastro. NAO e fonte de coleta.';



CREATE TABLE IF NOT EXISTS "public"."payroll_extrato_dominio_competencia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "competencia" "text" NOT NULL,
    "cod_empresa_dominio" "text" NOT NULL,
    "cnpj" "text" NOT NULL,
    "razao_social" "text",
    "arquivo_origem" "text",
    "total_geral_proventos" numeric(16,2),
    "total_geral_descontos" numeric(16,2),
    "liquido_geral" numeric(16,2),
    "base_fgts" numeric(16,2),
    "valor_fgts" numeric(16,2),
    "base_fgts_rescisorio" numeric(16,2),
    "valor_fgts_rescisorio" numeric(16,2),
    "total_inss" numeric(16,2),
    "inss_empresa" numeric(16,2),
    "rat" numeric(16,2),
    "terceiros" numeric(16,2),
    "no_empregados" integer,
    "trabalhando" integer,
    "demitido" integer,
    "admissoes" integer,
    "no_contribuintes" integer,
    "importado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payroll_extrato_dominio_competencia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_extrato_dominio_linha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competencia" "text" NOT NULL,
    "cod_colaborador" integer NOT NULL,
    "rubrica_codigo" integer NOT NULL,
    "valor" numeric(14,2) NOT NULL,
    "employee_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "natureza" "text" NOT NULL,
    CONSTRAINT "payroll_extrato_dominio_linha_natureza_check" CHECK (("natureza" = ANY (ARRAY['PROVENTO'::"text", 'DESCONTO'::"text"])))
);


ALTER TABLE "public"."payroll_extrato_dominio_linha" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_extrato_dominio_linha" IS 'Linhas do extrato Dominio por colaborador. Referencia de conferencia da coleta. NAO e fonte de coleta.';



CREATE TABLE IF NOT EXISTS "public"."payroll_extrato_dominio_rubrica" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competencia" "text" NOT NULL,
    "cod_empresa_dominio" "text" NOT NULL,
    "rubrica_codigo" integer NOT NULL,
    "rubrica_descricao" "text" NOT NULL,
    "natureza" "text" NOT NULL,
    "quantidade_texto" "text",
    "valor" numeric(14,2) NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    CONSTRAINT "payroll_extrato_dominio_rubrica_natureza_check" CHECK (("natureza" = ANY (ARRAY['PROVENTO'::"text", 'DESCONTO'::"text"])))
);


ALTER TABLE "public"."payroll_extrato_dominio_rubrica" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_extrato_dominio_rubrica" IS 'Resumo por rubrica do extrato Dominio. Alvo de conferencia da coleta KPH OS.';



COMMENT ON COLUMN "public"."payroll_extrato_dominio_rubrica"."quantidade_texto" IS 'Quantidade como impressa no extrato. Horas vem em HH:MM (ex. 747:47), dias e valores em decimal com virgula.';



CREATE TABLE IF NOT EXISTS "public"."payroll_extrato_dominio_totais" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competencia" "text" NOT NULL,
    "dimensao" "text" NOT NULL,
    "codigo" integer,
    "nome" "text",
    "proventos" numeric(14,2) NOT NULL,
    "descontos" numeric(14,2) NOT NULL,
    "liquido" numeric(14,2) NOT NULL,
    "unit_id" "uuid" NOT NULL,
    CONSTRAINT "payroll_extrato_dominio_totais_dimensao_check" CHECK (("dimensao" = ANY (ARRAY['DEPARTAMENTO'::"text", 'CENTRO_CUSTO'::"text", 'GERAL'::"text"])))
);


ALTER TABLE "public"."payroll_extrato_dominio_totais" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_fechamento_linha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "cod_folha" "text",
    "rubrica_id" "uuid" NOT NULL,
    "valor" numeric(14,4),
    "valor_horas" interval,
    "origem_lancamento" "text" DEFAULT 'AUTO'::"text" NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payroll_fechamento_linha_origem_lancamento_check" CHECK (("origem_lancamento" = ANY (ARRAY['AUTO'::"text", 'MANUAL'::"text", 'AJUSTE'::"text"])))
);


ALTER TABLE "public"."payroll_fechamento_linha" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_fechamento_linha" IS 'Uma linha por colaborador x rubrica. UNIQUE garante idempotencia na recoleta.';



CREATE TABLE IF NOT EXISTS "public"."payroll_fechamento_periodo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "competencia" "text" NOT NULL,
    "tipo_processo" "text" DEFAULT '11'::"text" NOT NULL,
    "status" "text" DEFAULT 'ABERTO'::"text" NOT NULL,
    "custo_total_folha" numeric(14,2),
    "gerado_por" "uuid",
    "gerado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payroll_fechamento_periodo_status_check" CHECK (("status" = ANY (ARRAY['ABERTO'::"text", 'EM_CONFERENCIA'::"text", 'ENVIADO_ESCRITORIO'::"text", 'APROVADO'::"text", 'FECHADO'::"text"]))),
    CONSTRAINT "payroll_fechamento_periodo_tipo_processo_check" CHECK (("tipo_processo" = ANY (ARRAY['11'::"text", '41'::"text", '42'::"text", '51'::"text", '52'::"text"])))
);


ALTER TABLE "public"."payroll_fechamento_periodo" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_fechamento_periodo" IS 'Cabecalho do fechamento mensal por unidade/CNPJ. custo_total_folha = input do DRE do Rich. competencia em texto p/ casar com ponto_mensal.periodo (ex: jan/26).';



CREATE TABLE IF NOT EXISTS "public"."payroll_rubricas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cod_kph" "text" NOT NULL,
    "grupo" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "tipo" "text" NOT NULL,
    "natureza_esocial" "text",
    "inc_inss" boolean,
    "inc_irrf" boolean,
    "inc_fgts" boolean,
    "unidade" "text" NOT NULL,
    "origem_dado" "text" NOT NULL,
    "cod_dominio" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payroll_rubricas_grupo_check" CHECK (("grupo" = ANY (ARRAY['IDENTIFICACAO'::"text", 'PROVENTO_FIXO'::"text", 'PROVENTO_VARIAVEL'::"text", 'DESCONTO'::"text", 'INFORMATIVA'::"text", 'BENEFICIO'::"text", 'BASE'::"text", 'RETORNO'::"text"]))),
    CONSTRAINT "payroll_rubricas_origem_dado_check" CHECK (("origem_dado" = ANY (ARRAY['AUTO_PONTO'::"text", 'AUTO_CADASTRO'::"text", 'AUTO'::"text", 'MANUAL_RH'::"text", 'JUDICIAL'::"text", 'EXTERNO'::"text", 'CALCULADO'::"text"]))),
    CONSTRAINT "payroll_rubricas_tipo_check" CHECK (("tipo" = ANY (ARRAY['PROVENTO'::"text", 'DESCONTO'::"text", 'INFORMATIVA'::"text", 'FLAG'::"text", 'BASE'::"text"]))),
    CONSTRAINT "payroll_rubricas_unidade_check" CHECK (("unidade" = ANY (ARRAY['R$'::"text", 'HORAS'::"text", 'DIAS'::"text", 'QTD'::"text", 'PERCENT'::"text", 'FLAG'::"text", 'TEXTO'::"text"])))
);


ALTER TABLE "public"."payroll_rubricas" OWNER TO "postgres";


COMMENT ON TABLE "public"."payroll_rubricas" IS 'Catalogo mestre de rubricas/verbas. Traduz eventos KPH -> codigos Dominio para importacao TXT. Natureza eSocial e cod_dominio: apenas confirmados; resto NULL.';



CREATE TABLE IF NOT EXISTS "public"."payslips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "competencia" "date" NOT NULL,
    "salario_base" numeric(10,2) NOT NULL,
    "horas_extras" numeric(10,2) DEFAULT 0,
    "adicional_noturno" numeric(10,2) DEFAULT 0,
    "gorjeta" numeric(10,2) DEFAULT 0,
    "dsr_gorjeta" numeric(10,2) DEFAULT 0,
    "desconto_inss" numeric(10,2) DEFAULT 0,
    "desconto_irrf" numeric(10,2) DEFAULT 0,
    "desconto_vale_transporte" numeric(10,2) DEFAULT 0,
    "desconto_vale_refeicao" numeric(10,2) DEFAULT 0,
    "outros_descontos" numeric(10,2) DEFAULT 0,
    "outros_acrescimos" numeric(10,2) DEFAULT 0,
    "liquido" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text",
    "pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fgts_base" numeric(10,2),
    "fgts_mes" numeric(10,2),
    "faixa_irrf" "text",
    "employee_code" "text",
    "unit_id" "uuid",
    "nome" "text",
    "tipo" "text",
    "cargo" "text",
    "bonus" numeric(10,2),
    "horas_trabalhadas" numeric DEFAULT 0,
    "adiantamento" numeric DEFAULT 0,
    "vt" numeric DEFAULT 0,
    "vr" numeric DEFAULT 0,
    "inss" numeric DEFAULT 0,
    "fgts" numeric DEFAULT 0,
    "valor_liquido" numeric DEFAULT 0,
    "observacoes" "text"
);


ALTER TABLE "public"."payslips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdi_metas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pdi_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "prazo" "date",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "progresso" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pdi_metas_progresso_check" CHECK ((("progresso" >= 0) AND ("progresso" <= 100))),
    CONSTRAINT "pdi_metas_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'em_andamento'::"text", 'concluida'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."pdi_metas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pdis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "criado_por" "uuid",
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "avaliacao_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "pdis_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."pdis" OWNER TO "postgres";


COMMENT ON TABLE "public"."pdis" IS 'Planos de Desenvolvimento Individual dos colaboradores KPH.';



CREATE TABLE IF NOT EXISTS "public"."performance_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "avaliador_id" "uuid",
    "periodo" "text" NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "nota_geral" numeric(4,2),
    "respostas" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "pontos_fortes" "text",
    "pontos_melhoria" "text",
    "plano_acao" "text",
    "data_avaliacao" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tipo_avaliador" "text" DEFAULT 'gestor'::"text",
    "anonimo" boolean DEFAULT false,
    CONSTRAINT "performance_reviews_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'concluida'::"text", 'aprovada'::"text"]))),
    CONSTRAINT "performance_reviews_tipo_avaliador_check" CHECK (("tipo_avaliador" = ANY (ARRAY['autoavaliacao'::"text", 'par'::"text", 'gestor'::"text", 'liderado'::"text"])))
);


ALTER TABLE "public"."performance_reviews" OWNER TO "postgres";


COMMENT ON TABLE "public"."performance_reviews" IS 'Avaliações de desempenho individuais — linked to templates e ciclos.';



CREATE TABLE IF NOT EXISTS "public"."performance_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "funcao" "text",
    "periodicidade" "text" NOT NULL,
    "criterios" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ativo" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "performance_templates_periodicidade_check" CHECK (("periodicidade" = ANY (ARRAY['mensal'::"text", 'trimestral'::"text", 'semestral'::"text", 'anual'::"text"])))
);


ALTER TABLE "public"."performance_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_members" (
    "plan_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."plan_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plano_contas" (
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "grupo" "text" NOT NULL,
    "ordem" integer NOT NULL,
    "ncm_capitulos" "text"[],
    "ativo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "plano_contas_grupo_check" CHECK (("grupo" = ANY (ARRAY['receita'::"text", 'deducao'::"text", 'cmv'::"text", 'mao_de_obra'::"text", 'despesa_operacional'::"text", 'financeiro'::"text", 'investimento'::"text", 'imposto_lucro'::"text", 'nao_operacional'::"text"])))
);


ALTER TABLE "public"."plano_contas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ponto_mensal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "employee_id" "uuid",
    "matricula" "text",
    "nome" "text" NOT NULL,
    "cpf" "text",
    "cargo" "text",
    "departamento" "text",
    "periodo" "text" NOT NULL,
    "horas_previstas" "text",
    "horas_trabalhadas" "text",
    "horas_negativas" "text",
    "horas_positivas" "text",
    "saldo" "text",
    "banco_horas_acumulado" "text",
    "banco_horas_mes" "text",
    "compensacao_bh" "text",
    "adicional_noturno" "text",
    "falta_injustificada_horas" "text",
    "falta_injustificada_dias" integer DEFAULT 0,
    "afastamentos_horas" "text",
    "afastamentos_dias" integer DEFAULT 0,
    "ferias_horas" "text",
    "ferias_dias" integer DEFAULT 0,
    "inss_horas" "text",
    "inss_dias" integer DEFAULT 0,
    "atestado_medico" "text",
    "abonado_horas" "text",
    "abonado_dias" integer DEFAULT 0,
    "folga_domingo" "text",
    "folga_feriado" "text",
    "feriados_dias" integer DEFAULT 0,
    "confraternizacao" "text",
    "licenca_paternidade_horas" "text",
    "licenca_paternidade_dias" integer DEFAULT 0,
    "data_admissao" "text",
    "data_demissao" "text",
    "importado_em" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ponto_mensal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "unidade" "text" DEFAULT 'kg'::"text" NOT NULL,
    "quantidade" numeric(10,3) NOT NULL,
    "preco_unitario" numeric(10,4),
    "total" numeric(12,2) GENERATED ALWAYS AS (
CASE
    WHEN ("preco_unitario" IS NOT NULL) THEN ("quantidade" * "preco_unitario")
    ELSE NULL::numeric
END) STORED,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_quote_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "periodo" "date" NOT NULL,
    "status" "public"."quote_status" DEFAULT 'rascunho'::"public"."quote_status" NOT NULL,
    "titulo" "text",
    "observacoes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos_catalogo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "ncm" "text",
    "unidade_padrao" "text",
    "categoria" "text",
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produtos_catalogo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos_depara" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "produto_id" "uuid",
    "fornecedor_cnpj" "text" NOT NULL,
    "fornecedor_nome" "text",
    "item_codigo" "text" NOT NULL,
    "item_descricao" "text",
    "ncm" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."produtos_depara" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."produtos_relatorio" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "fornecedor_nome" "text",
    "nr_danfe" "text",
    "v_total_danfe" numeric(18,4),
    "dt_emissao" "text",
    "item_codigo" "text",
    "item_descricao" "text",
    "unidade_medida" "text",
    "tipo_item" "text",
    "q_embalagem" numeric(18,4),
    "q_estoque" numeric(18,4),
    "v_embalagem" numeric(18,4),
    "v_total_embalagem" numeric(18,4),
    "v_custo_medio" numeric(18,4),
    "v_custo_compra" numeric(18,4),
    "v_custo_total" numeric(18,4),
    "perc_variacao" numeric(18,4),
    "calcula_cmv" boolean,
    "fornecedor_codigo" "text",
    "codigo_gerencial" "text",
    "desc_gerencial" "text",
    "mes_lancamento" integer NOT NULL,
    "ano_lancamento" integer NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "chave_nfe" "text",
    "direcao_nfe" "text",
    "cfop" "text",
    "importacao_id" "uuid",
    "observacao_origem" "text",
    "desconto_origem" numeric(14,2),
    "pedido_origem" "text",
    "produto_id" "uuid",
    "item_nfe" integer,
    CONSTRAINT "produtos_relatorio_direcao_nfe_check" CHECK (("direcao_nfe" = ANY (ARRAY['entrada'::"text", 'saida'::"text"])))
);


ALTER TABLE "public"."produtos_relatorio" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."produtos_relatorio_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."produtos_relatorio_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."produtos_relatorio_id_seq" OWNED BY "public"."produtos_relatorio"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "created_by" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text",
    "invited_by" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"]))),
    CONSTRAINT "project_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);


ALTER TABLE "public"."project_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "status" "text" DEFAULT 'Não iniciado'::"text",
    "owner_id" "uuid",
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['Não iniciado'::"text", 'Em andamento'::"text", 'Concluído'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protestos_certidoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "data_certidao" "date",
    "nome_devedor" "text",
    "cnpj_devedor" "text",
    "protestos_declarados" integer NOT NULL,
    "storage_path" "text" NOT NULL,
    "nome_arquivo" "text" NOT NULL,
    "tamanho_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."protestos_certidoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protestos_registros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "certidao_id" "uuid" NOT NULL,
    "numero_registro" integer NOT NULL,
    "apresentante" "text",
    "cnpj_apresentante" "text",
    "especie" "text",
    "protocolo_e_data" "text",
    "motivo" "text",
    "data_protesto" "date",
    "emissao" "date",
    "vencimento" "text",
    "valor_titulo" numeric(14,2),
    "valor_protestado" numeric(14,2),
    "valor_para_cancelar" numeric(14,2),
    "numero_titulo" "text",
    "tipo_notificacao" "text",
    "livro_folha" "text",
    "situacao" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "protestos_registros_situacao_check" CHECK (("situacao" = ANY (ARRAY['em_aberto'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."protestos_registros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."punch_adjustment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "data_referencia" "date" NOT NULL,
    "horario_saida_almoco" time without time zone NOT NULL,
    "horario_retorno_almoco" time without time zone NOT NULL,
    "motivo" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "aprovado_por" "uuid",
    "aprovado_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "punch_adjustment_requests_motivo_check" CHECK (("motivo" = ANY (ARRAY['Esqueci de registrar'::"text", 'Estava em atendimento'::"text", 'Sistema indisponível'::"text", 'Saí para entrega/serviço externo'::"text", 'Outro'::"text"]))),
    CONSTRAINT "punch_adjustment_requests_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovado'::"text", 'rejeitado'::"text"])))
);


ALTER TABLE "public"."punch_adjustment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_invoice_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "ingredient_codigo" "text" NOT NULL,
    "ingredient_nome" "text" NOT NULL,
    "unidade" "text",
    "quantidade_embalagem" numeric(14,4),
    "quantidade_estoque" numeric(14,4),
    "valor_embalagem" numeric(14,4),
    "valor_total" numeric(14,2),
    "custo_medio" numeric(14,4),
    "custo_ultima_compra" numeric(14,4),
    "categoria_gerencial_codigo" "text",
    "categoria_gerencial_nome" "text",
    "data_lancamento" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "numero_danfe" "text" NOT NULL,
    "valor_total" numeric(14,2) NOT NULL,
    "data_emissao" "date" NOT NULL,
    "fornecedor_codigo" "text",
    "fornecedor_nome" "text",
    "cfop" "text",
    "origem" "text",
    "situacao" "text",
    "mes_referencia" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "unidade" "text",
    "quantidade" numeric(12,3) DEFAULT 0 NOT NULL,
    "quantidade_recebida" numeric(12,3) DEFAULT 0 NOT NULL,
    "preco_unitario" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(14,2) GENERATED ALWAYS AS (("quantidade" * "preco_unitario")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."purchase_orders_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."purchase_orders_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "numero" "text" DEFAULT ('PO-'::"text" || "lpad"(("nextval"('"public"."purchase_orders_numero_seq"'::"regclass"))::"text", 6, '0'::"text")) NOT NULL,
    "fornecedor" "text",
    "supplier_id" "uuid",
    "status" "public"."purchase_order_status" DEFAULT 'rascunho'::"public"."purchase_order_status" NOT NULL,
    "data_pedido" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_prevista" "date",
    "valor_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "observacoes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "solicitante_nome" "text",
    CONSTRAINT "purchase_orders_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"public"."purchase_order_status", 'enviado'::"public"."purchase_order_status", 'parcial'::"public"."purchase_order_status", 'recebido'::"public"."purchase_order_status", 'cancelado'::"public"."purchase_order_status"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quadro_ideal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "departamento" "text",
    "cargo" "text",
    "cargo_grupo_id" "uuid",
    "qtd_alvo" integer NOT NULL,
    "vigente_desde" "date" DEFAULT (("now"() AT TIME ZONE 'America/Sao_Paulo'::"text"))::"date" NOT NULL,
    "vigente_ate" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cargo_id" "uuid",
    "alvo_manha" integer DEFAULT 0 NOT NULL,
    "alvo_tarde" integer DEFAULT 0 NOT NULL,
    "alvo_noite" integer DEFAULT 0 NOT NULL,
    "alvo_madrugada" integer DEFAULT 0 NOT NULL,
    "alvo_intermediario" integer DEFAULT 0 NOT NULL,
    "reporta_a_cargo_id" "uuid",
    CONSTRAINT "quadro_ideal_qtd_alvo_check" CHECK (("qtd_alvo" >= 0))
);


ALTER TABLE "public"."quadro_ideal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quality_checklists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "area" "public"."checklist_area" DEFAULT 'geral'::"public"."checklist_area" NOT NULL,
    "turno" "public"."checklist_turno" DEFAULT 'abertura'::"public"."checklist_turno" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quality_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recebimento_itens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recebimento_id" "uuid" NOT NULL,
    "pedido_item_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "quantidade_pedida" numeric NOT NULL,
    "quantidade_recebida" numeric DEFAULT 0 NOT NULL,
    "unidade" "text" NOT NULL,
    "status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recebimento_itens_status_check" CHECK (("status" = ANY (ARRAY['ok'::"text", 'parcial'::"text", 'nao_recebido'::"text"])))
);


ALTER TABLE "public"."recebimento_itens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recebimentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "recebido_por" "uuid" NOT NULL,
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "assinatura_nome" "text",
    CONSTRAINT "recebimentos_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'finalizado'::"text"])))
);


ALTER TABLE "public"."recebimentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recebiveis_cartao" (
    "id" bigint NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data_venda" "date" NOT NULL,
    "bandeira" "text",
    "modalidade" "text" NOT NULL,
    "valor_bruto" numeric(16,2) NOT NULL,
    "taxa_adquirente" numeric(16,2),
    "data_prevista" "date",
    "antecipado" boolean DEFAULT false NOT NULL,
    "data_antecipacao" "date",
    "taxa_antecipacao" numeric(16,2),
    "valor_liquido" numeric(16,2),
    CONSTRAINT "recebiveis_cartao_modalidade_check" CHECK (("modalidade" = ANY (ARRAY['debito'::"text", 'credito'::"text", 'credito_parcelado'::"text", 'voucher'::"text", 'app'::"text"])))
);


ALTER TABLE "public"."recebiveis_cartao" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recebiveis_cartao_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recebiveis_cartao_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."recebiveis_cartao_id_seq" OWNED BY "public"."recebiveis_cartao"."id";



CREATE TABLE IF NOT EXISTS "public"."receita_ambientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "ambiente" character varying NOT NULL,
    "clientes" integer,
    "gorjeta" numeric,
    "produto" numeric,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_ambientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_caixas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "caixa_id" integer,
    "operador" character varying,
    "abertura_at" timestamp with time zone,
    "fechamento_at" timestamp with time zone,
    "total_fechado" numeric,
    "total_recebido" numeric,
    "diferenca" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_cancelamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "motivo" character varying NOT NULL,
    "qtd" integer,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_cancelamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_descontos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "motivo" character varying NOT NULL,
    "qtd" integer,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_descontos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_dias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "data" "date" NOT NULL,
    "workday_id" integer,
    "turno" character varying DEFAULT 'dia_inteiro'::character varying NOT NULL,
    "abertura_at" timestamp with time zone,
    "fechamento_at" timestamp with time zone,
    "receita_bruta" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "receita_liquida" numeric,
    "custo" numeric,
    "cmv_pct" numeric,
    "lucro" numeric,
    "clientes" integer,
    "ticket_medio" numeric,
    "ticket_real" numeric,
    "permanencia_media" interval,
    "previsto" numeric,
    "devedor" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"(),
    "importacao_id" "uuid",
    "gorjeta_colaborador" numeric(14,2),
    "gorjeta_casa" numeric(14,2),
    "gorjeta_terceiro" numeric(14,2)
);


ALTER TABLE "public"."receita_dias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_grupos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "grupo" character varying NOT NULL,
    "pct_bruto" numeric,
    "bruto" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_grupos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_horarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "hora" integer NOT NULL,
    "clientes" integer,
    "gorjeta" numeric,
    "produto" numeric,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_horarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_import_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_id" character varying,
    "filename" character varying,
    "tipo" character varying,
    "data_referente" "date",
    "status" character varying,
    "erro" "text",
    "processado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_import_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "forma" character varying NOT NULL,
    "valor_fechado" numeric,
    "valor_recebido" numeric,
    "diferenca" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_pagamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_turnos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "turno" character varying NOT NULL,
    "clientes" integer,
    "gorjeta" numeric,
    "produto" numeric,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_turnos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receita_usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workday_id_fk" "uuid",
    "usuario" character varying NOT NULL,
    "qtd" integer,
    "gorjeta" numeric,
    "produto" numeric,
    "consumo" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receita_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "insumo" "text" DEFAULT ''::"text" NOT NULL,
    "unidade" "text",
    "quantidade" numeric(12,4) DEFAULT 0 NOT NULL,
    "custo_unitario" numeric(12,4) DEFAULT 0 NOT NULL,
    "custo_total" numeric(14,4) GENERATED ALWAYS AS (("quantidade" * "custo_unitario")) STORED,
    "perda_pct" numeric(5,2) DEFAULT 0,
    "ordem" integer DEFAULT 0,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipe_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "nota" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipe_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reconciliacoes_sugeridas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "titulo_id" "text" NOT NULL,
    "chave_nfe" "text" NOT NULL,
    "score" numeric(5,2) NOT NULL,
    "valor_titulo" numeric(16,2) NOT NULL,
    "valor_nfe" numeric(16,2) NOT NULL,
    "dias_diferenca" integer NOT NULL,
    "status" "text" DEFAULT 'sugerida'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "competencia" "date",
    CONSTRAINT "reconciliacoes_sugeridas_status_check" CHECK (("status" = ANY (ARRAY['sugerida'::"text", 'confirmada'::"text", 'rejeitada'::"text", 'sem_xml'::"text"])))
);


ALTER TABLE "public"."reconciliacoes_sugeridas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regras_classificacao" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "tipo" "text" NOT NULL,
    "padrao" "text" NOT NULL,
    "conta_codigo" "text" NOT NULL,
    "prioridade" integer DEFAULT 100 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "regras_classificacao_tipo_check" CHECK (("tipo" = ANY (ARRAY['fornecedor_cnpj'::"text", 'fornecedor_nome'::"text", 'descricao_contem'::"text", 'categoria_gerencial'::"text"])))
);


ALTER TABLE "public"."regras_classificacao" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."relatorio_produtos" (
    "id" integer NOT NULL,
    "unit_id" "uuid",
    "fornecedor_codigo" integer,
    "fornecedor_nome" "text",
    "nr_danfe" "text",
    "v_total_danfe" numeric,
    "dt_emissao" "date",
    "item_codigo" "text",
    "item_descricao" "text",
    "unidade_medida" "text",
    "tipo_item" "text",
    "q_embalagem" numeric,
    "q_estoque" numeric,
    "v_embalagem" numeric,
    "v_total_embalagem" numeric,
    "v_custo_medio" numeric,
    "v_custo_compra" numeric,
    "v_custo_total" numeric,
    "perc_variacao" numeric,
    "calcula_cmv" boolean,
    "codigo_gerencial" integer,
    "desc_gerencial" "text",
    "mes_lancamento" integer,
    "ano_lancamento" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."relatorio_produtos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."relatorio_produtos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."relatorio_produtos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."relatorio_produtos_id_seq" OWNED BY "public"."relatorio_produtos"."id";



CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "hora" time without time zone NOT NULL,
    "pax" integer NOT NULL,
    "status" "public"."reservation_status" DEFAULT 'pendente'::"public"."reservation_status" NOT NULL,
    "origem" "public"."reservation_origem" DEFAULT 'whatsapp'::"public"."reservation_origem" NOT NULL,
    "cliente_nome" "text" NOT NULL,
    "cliente_telefone" "text",
    "cliente_email" "text",
    "mesa" "text",
    "observacoes" "text",
    "confirmado_por" "uuid",
    "confirmado_em" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reservations_pax_check" CHECK (("pax" > 0))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reuniao_action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reuniao_id" "uuid" NOT NULL,
    "descricao" "text" NOT NULL,
    "responsavel_id" "uuid",
    "prazo" "date",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reuniao_action_items_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."reuniao_action_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reunioes_1on1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "gestor_id" "uuid" NOT NULL,
    "colaborador_id" "uuid" NOT NULL,
    "data_reuniao" timestamp with time zone NOT NULL,
    "duracao_min" integer DEFAULT 30,
    "status" "text" DEFAULT 'agendada'::"text" NOT NULL,
    "notas" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reuniao_diferentes" CHECK (("gestor_id" <> "colaborador_id")),
    CONSTRAINT "reunioes_1on1_status_check" CHECK (("status" = ANY (ARRAY['agendada'::"text", 'realizada'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."reunioes_1on1" OWNER TO "postgres";


COMMENT ON TABLE "public"."reunioes_1on1" IS 'Reuniões 1:1 entre gestores e colaboradores KPH.';



CREATE TABLE IF NOT EXISTS "public"."roadmap_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "sprint" integer NOT NULL,
    "status" "text" DEFAULT 'backlog'::"text" NOT NULL,
    "module" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roadmap_items_status_check" CHECK (("status" = ANY (ARRAY['backlog'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."roadmap_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "dept" "text",
    "tier" "text",
    "level" "text",
    "sector" "text",
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "roles_tier_check" CHECK (("tier" = ANY (ARRAY['T1'::"text", 'T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"])))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."score_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "delta" integer NOT NULL,
    "descricao" "text",
    "referencia_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."score_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "hora_inicio" time without time zone NOT NULL,
    "hora_fim" time without time zone NOT NULL,
    "tipo" "text" DEFAULT 'normal'::"text",
    "labor_cost" numeric(10,2),
    "observacao" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "area" "text",
    CONSTRAINT "shifts_area_check" CHECK ((("area" IS NULL) OR ("area" = ANY (ARRAY['Adm'::"text", 'Salão'::"text", 'Cozinha'::"text", 'Limpeza'::"text", 'Bar'::"text", 'Hostess & Segurança'::"text", 'Cozinha de Apoio'::"text", 'Estoque'::"text"]))))
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sick_leaves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "data_inicio" "date",
    "data_fim" "date",
    "total_dias" integer,
    "tipo" "text" DEFAULT 'atestado'::"text",
    "cid" "text",
    "medico" "text",
    "documento_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sick_leaves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "nome" "text" NOT NULL,
    "cnpj" "text",
    "telefone" "text",
    "email" "text",
    "categoria" "text",
    "ativo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."target_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_id" "uuid" NOT NULL,
    "nota" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."target_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignees" (
    "task_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL
);


ALTER TABLE "public"."task_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "status" "text" DEFAULT 'Não iniciado'::"text" NOT NULL,
    "bucket_id" "uuid",
    "start_date" "date",
    "label_text" "text",
    "label_color" "text",
    "priority" "text" DEFAULT 'Média'::"text",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['Baixa'::"text", 'Média'::"text", 'Alta'::"text", 'Urgente'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['Não iniciado'::"text", 'Em andamento'::"text", 'Concluído'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terminations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "tipo_aviso" "text",
    "data_aviso" "date",
    "motivo" "text",
    "status" "text" DEFAULT 'registrado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."terminations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."theo_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "categoria" "text" NOT NULL,
    "descricao" "text",
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."theo_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_bank_balance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "saldo_minutos" integer DEFAULT 0,
    "ultimo_calculo" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'kph'::"text",
    "observacao" "text"
);


ALTER TABLE "public"."time_bank_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_clock_punches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "timestamp_punch" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "device_info" "text",
    "aprovado" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "distance_meters" integer,
    "aprovado_por" "uuid",
    "gps_failed" boolean DEFAULT false
);


ALTER TABLE "public"."time_clock_punches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "periodo" "text" NOT NULL,
    "horas_previstas" "text",
    "horas_trabalhadas" "text",
    "banco_horas_positivo" "text",
    "banco_horas_negativo" "text",
    "saldo_banco" "text",
    "banco_horas_acumulado" "text",
    "faltas_injustificadas_dias" integer DEFAULT 0,
    "atestado_horas" "text",
    "afastamentos_dias" integer DEFAULT 0,
    "ferias_dias" integer DEFAULT 0,
    "adicional_noturno" "text",
    "fonte" "text" DEFAULT 'totvs'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."time_records" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tips_records" WITH ("security_invoker"='true') AS
 SELECT ("md5"((("employee_id")::"text" || "to_char"(("data")::timestamp with time zone, 'YYYY-MM'::"text"))))::"uuid" AS "id",
    "employee_id",
    "to_char"(("data")::timestamp with time zone, 'YYYY-MM'::"text") AS "periodo",
    ("sum"("pontos"))::numeric(10,2) AS "total_pontos",
    ("sum"("pontos"))::numeric(10,2) AS "pontos_liquidos",
        CASE
            WHEN ("sum"("pontos") > 0) THEN (("sum"("valor_calculado") / ("sum"("pontos"))::numeric))::numeric(10,4)
            ELSE (0)::numeric
        END AS "valor_ponto",
    ("sum"("valor_calculado"))::numeric(10,2) AS "valor"
   FROM "public"."gorjeta_dias" "gd"
  WHERE ("employee_id" IS NOT NULL)
  GROUP BY "employee_id", ("to_char"(("data")::timestamp with time zone, 'YYYY-MM'::"text"));


ALTER VIEW "public"."tips_records" OWNER TO "postgres";


COMMENT ON VIEW "public"."tips_records" IS 'Agrega gorjeta_dias por colaborador/mês para o app mobile HOS. Read-only. security_invoker=true: respeita RLS da tabela base (kph_has_role_for_unit).';



CREATE TABLE IF NOT EXISTS "public"."titulo_override" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo_id" "text" NOT NULL,
    "linha_dre_corrigida" "text",
    "observacao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."titulo_override" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."titulo_pagamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "titulo_id" "text" NOT NULL,
    "conta_id" "uuid" NOT NULL,
    "data" "date" NOT NULL,
    "valor" numeric(14,2) NOT NULL,
    "comprovante" "text" NOT NULL,
    "criado_por" "uuid" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "estornado_em" timestamp with time zone,
    "estornado_por" "uuid",
    "pedido_id" "uuid" NOT NULL,
    CONSTRAINT "titulo_pagamentos_comprovante_check" CHECK (("length"(TRIM(BOTH FROM "comprovante")) > 0)),
    CONSTRAINT "titulo_pagamentos_valor_check" CHECK (("valor" > (0)::numeric))
);


ALTER TABLE "public"."titulo_pagamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."titulos_a_pagar" (
    "id" "text" NOT NULL,
    "tipo" "text",
    "n_nota_fiscal" "text",
    "fantasia_fornecedor" "text",
    "razao_fornecedor" "text",
    "cnpj_cpf_fornecedor" "text",
    "t_fornecedor" "text",
    "descricao_c_gerencial" "text",
    "n_titulo" "text",
    "parcela" "text",
    "portador" "text",
    "d_lancamento" "date",
    "d_competencia" "date",
    "d_vencimento" "date",
    "v_titulo" numeric,
    "v_saldo_atual" numeric,
    "dias_atraso_atual" integer,
    "situacao_atual" "text",
    "tipo_sep" "text",
    "fluxo_de_caixa" boolean DEFAULT false,
    "importado_em" timestamp with time zone DEFAULT "now"(),
    "ref_mes" "date",
    "origem" "text",
    "empresa" "text",
    "fantasia_empresa" "text",
    "fornecedor" "text",
    "n_conta" "text",
    "grupo_economico" "text",
    "cep" "text",
    "bairro" "text",
    "cidade" "text",
    "uf" "text",
    "pais" "text",
    "condicao_compra" "text",
    "prazo_medio" numeric,
    "serie" "text",
    "documento" "text",
    "portador_num" "text",
    "c_gerencial" "text",
    "d_autorizacao_pgto" "date",
    "dia_semana" "text",
    "v_desconto" numeric,
    "v_multa_atraso" numeric,
    "v_juros_dia" numeric,
    "v_original" numeric,
    "v_saldo_anterior" numeric,
    "v_credito_periodo" numeric,
    "v_debito_periodo" numeric,
    "d_liquidacao_periodo" "date",
    "situacao_periodo" "text",
    "v_saldo_periodo" numeric,
    "dias_atraso_periodo" numeric,
    "v_atraso_periodo" numeric,
    "v_atualizado_periodo" numeric,
    "d_liquidacao_atual" "date",
    "v_atraso_atual" numeric,
    "v_atualizado_atual" numeric,
    "ano" numeric,
    "mes" "text",
    "semana" numeric,
    "trimestre" numeric,
    "quadrimestre" numeric,
    "unit_id" "uuid",
    "v_pagamento" numeric,
    "d_liquidacao" "date",
    "forma_pagamento" "text",
    "posicao" "text",
    "dre" "text",
    "importacao_id" "uuid",
    "valor_total_nf_origem" numeric(14,2),
    "liquidacao_origem" "text",
    "import_unit_id" "uuid"
);


ALTER TABLE "public"."titulos_a_pagar" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_id" "uuid",
    "employee_id" "uuid",
    "status" "text" DEFAULT 'inscrito'::"text",
    "nota" numeric,
    "certificado_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "data_inicio" "date",
    "data_conclusao" "date",
    "validade_dias_snapshot" integer,
    "validade_ate" "date" GENERATED ALWAYS AS (
CASE
    WHEN (("data_conclusao" IS NULL) OR ("validade_dias_snapshot" IS NULL)) THEN NULL::"date"
    ELSE ("data_conclusao" + "validade_dias_snapshot")
END) STORED,
    "observacoes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_records_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'em_andamento'::"text", 'concluido'::"text", 'vencido'::"text"])))
);


ALTER TABLE "public"."training_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."training_records" IS 'Registro de conclusão de treinamentos por colaborador.';



CREATE TABLE IF NOT EXISTS "public"."training_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "nome" "text" NOT NULL,
    "descricao" "text",
    "funcao" "text",
    "obrigatorio" boolean DEFAULT false,
    "validade_dias" integer,
    "ativo" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."training_templates" IS 'Catálogo de treinamentos obrigatórios e opcionais do grupo KPH.';



CREATE TABLE IF NOT EXISTS "public"."trainings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "tipo" "text" DEFAULT 'interno'::"text",
    "carga_horaria" numeric,
    "data_inicio" "date",
    "data_fim" "date",
    "instrutor" "text",
    "status" "text" DEFAULT 'agendado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trainings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transport_vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "periodo" "text" NOT NULL,
    "dias_uteis" integer,
    "valor_diario" numeric(10,2),
    "total_bruto" numeric(10,2),
    "desconto_funcionario" numeric(10,2),
    "valor_empresa" numeric(10,2),
    "operadora" "text",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."transport_vouchers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uniforms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "item" "text",
    "tamanho" "text",
    "quantidade" integer,
    "data_entrega" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."uniforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_cnpjs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "cnpj" "text" NOT NULL,
    "razao_social" "text",
    "papel" "text" NOT NULL,
    "ativo" boolean DEFAULT true NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unit_cnpjs_papel_check" CHECK (("papel" = ANY (ARRAY['folha'::"text", 'compras'::"text", 'faturamento'::"text"])))
);


ALTER TABLE "public"."unit_cnpjs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "brand_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "whatsapp_number" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cnpj" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "geofence_radius_m" integer DEFAULT 200
);


ALTER TABLE "public"."units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "brand_id" "uuid",
    "group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_roles_check" CHECK ((("unit_id" IS NOT NULL) OR ("brand_id" IS NOT NULL) OR ("group_id" IS NOT NULL)))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_alertas" WITH ("security_invoker"='true') AS
 SELECT "tipo_alerta",
    "severidade",
    "brand_id",
    "brand_name",
    "resource_id",
    "mensagem",
    "created_at"
   FROM ( SELECT 'evento_pendente'::"text" AS "tipo_alerta",
            'warning'::"text" AS "severidade",
            "e"."brand_id",
            "b"."name" AS "brand_name",
            "e"."id" AS "resource_id",
            (((('O.S. '::"text" || "e"."nome") || ' aguarda aprovação há '::"text") || (((EXTRACT(epoch FROM ("now"() - "e"."created_at")))::integer / 3600))::"text") || 'h'::"text") AS "mensagem",
            "e"."created_at"
           FROM ("public"."events" "e"
             JOIN "public"."brands" "b" ON (("b"."id" = "e"."brand_id")))
          WHERE (("e"."status" = 'pendente_aprovacao'::"public"."event_status") AND ("e"."created_at" < ("now"() - '24:00:00'::interval)))
        UNION ALL
         SELECT 'evento_sem_equipe'::"text" AS "tipo_alerta",
            'error'::"text" AS "severidade",
            "e"."brand_id",
            "b"."name" AS "brand_name",
            "e"."id" AS "resource_id",
            (((('O.S. '::"text" || "e"."nome") || ' em '::"text") || "to_char"("e"."data_inicio", 'DD/MM HH24:MI'::"text")) || ' sem equipe escalada'::"text") AS "mensagem",
            "e"."created_at"
           FROM ("public"."events" "e"
             JOIN "public"."brands" "b" ON (("b"."id" = "e"."brand_id")))
          WHERE (("e"."status" = 'aprovado'::"public"."event_status") AND ("e"."data_inicio" <= ("now"() + '48:00:00'::interval)) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."event_staff" "es"
                  WHERE ("es"."event_id" = "e"."id")))))
        UNION ALL
         SELECT 'evento_sem_cardapio'::"text" AS "tipo_alerta",
            'warning'::"text" AS "severidade",
            "e"."brand_id",
            "b"."name" AS "brand_name",
            "e"."id" AS "resource_id",
            (((('O.S. '::"text" || "e"."nome") || ' em '::"text") || "to_char"("e"."data_inicio", 'DD/MM HH24:MI'::"text")) || ' sem cardápio definido'::"text") AS "mensagem",
            "e"."created_at"
           FROM ("public"."events" "e"
             JOIN "public"."brands" "b" ON (("b"."id" = "e"."brand_id")))
          WHERE (("e"."status" = 'aprovado'::"public"."event_status") AND ("e"."data_inicio" <= ("now"() + '48:00:00'::interval)) AND (NOT (EXISTS ( SELECT 1
                   FROM "public"."event_menu_items" "mi"
                  WHERE ("mi"."event_id" = "e"."id")))))) "alertas";


ALTER VIEW "public"."v_alertas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_aprovacoes_pendentes" WITH (security_invoker = true) AS
 SELECT "id",
    "unit_id",
    "criado_em"
   FROM "public"."dre_despesa_detalhada"
  WHERE false;


ALTER VIEW "public"."v_aprovacoes_pendentes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cadastro_saude" WITH (security_invoker = true) AS
 WITH "fichas_me" AS (
         SELECT "ri"."ingredient_id",
            "count"(*) AS "n_fichas"
           FROM ("public"."recipe_items" "ri"
             JOIN "public"."menu_items" "mi" ON (("mi"."id" = "ri"."menu_item_id")))
          WHERE (true AND ("mi"."ativo" = true))
          GROUP BY "ri"."ingredient_id"
        ), "produtos" AS (
         SELECT 'produto'::"text" AS "tipo_item",
                CASE
                    WHEN "mi"."is_subproduto" THEN 'subproduto'::"text"
                    ELSE 'vendavel'::"text"
                END AS "subtipo",
            "mi"."id" AS "item_id",
            "mi"."nome",
            "mi"."categoria",
            (("mi"."categoria" IS NOT NULL) AND ("mi"."categoria" <> ALL (ARRAY['outros'::"text", 'outro'::"text", ''::"text"]))) AS "tem_categoria",
                CASE
                    WHEN "mi"."is_subproduto" THEN true
                    ELSE (COALESCE("mi"."preco_venda", (0)::numeric) > (0)::numeric)
                END AS "tem_preco",
            (COALESCE("mi"."custo_total", (0)::numeric) > (0)::numeric) AS "tem_custo",
            (EXISTS ( SELECT 1
                   FROM "public"."recipe_items" "ri"
                  WHERE ("ri"."menu_item_id" = "mi"."id"))) AS "tem_ficha",
            (TRIM(BOTH FROM "mi"."nome") ~~ '% -'::"text") AS "eh_everest",
                CASE
                    WHEN "mi"."is_subproduto" THEN
                    CASE
                        WHEN (NOT (COALESCE("mi"."custo_total", (0)::numeric) > (0)::numeric)) THEN 1
                        WHEN ((COALESCE("mi"."custo_total", (0)::numeric) > (0)::numeric) AND (NOT (("mi"."categoria" IS NOT NULL) AND ("mi"."categoria" <> ALL (ARRAY['outros'::"text", 'outro'::"text", ''::"text"]))))) THEN 2
                        ELSE 3
                    END
                    ELSE
                    CASE
                        WHEN ((NOT (COALESCE("mi"."preco_venda", (0)::numeric) > (0)::numeric)) OR (NOT (COALESCE("mi"."custo_total", (0)::numeric) > (0)::numeric))) THEN 1
                        WHEN ((COALESCE("mi"."preco_venda", (0)::numeric) > (0)::numeric) AND (COALESCE("mi"."custo_total", (0)::numeric) > (0)::numeric) AND (NOT (("mi"."categoria" IS NOT NULL) AND ("mi"."categoria" <> ALL (ARRAY['outros'::"text", 'outro'::"text", ''::"text"]))))) THEN 2
                        ELSE 3
                    END
                END AS "camada_prontidao",
            COALESCE("mi"."preco_venda", (0)::numeric) AS "peso_relevancia",
            "upper"(TRIM(BOTH FROM "regexp_replace"(TRIM(BOTH FROM "mi"."nome"), '\s*-\s*$'::"text", ''::"text"))) AS "nome_normalizado",
            true AS "fonte_ok"
           FROM "public"."menu_items" "mi"
          WHERE (("mi"."ativo" = true) AND true)
        ), "insumos" AS (
         SELECT 'insumo'::"text" AS "tipo_item",
            'insumo'::"text" AS "subtipo",
            "i"."id" AS "item_id",
            "i"."nome",
            "i"."categoria",
            (("i"."categoria" IS NOT NULL) AND ("i"."categoria" <> ALL (ARRAY['outro'::"text", ''::"text"]))) AS "tem_categoria",
            true AS "tem_preco",
            (COALESCE("i"."custo_padrao", (0)::numeric) > (0)::numeric) AS "tem_custo",
            true AS "tem_ficha",
            (TRIM(BOTH FROM "i"."nome") ~~ '% -'::"text") AS "eh_everest",
                CASE
                    WHEN (NOT (COALESCE("i"."custo_padrao", (0)::numeric) > (0)::numeric)) THEN 1
                    WHEN ((COALESCE("i"."custo_padrao", (0)::numeric) > (0)::numeric) AND (NOT (("i"."categoria" IS NOT NULL) AND ("i"."categoria" <> ALL (ARRAY['outro'::"text", ''::"text"]))))) THEN 2
                    ELSE 3
                END AS "camada_prontidao",
            (COALESCE("fme"."n_fichas", (0)::bigint))::numeric AS "peso_relevancia",
            "upper"(TRIM(BOTH FROM "regexp_replace"(TRIM(BOTH FROM "i"."nome"), '\s*-\s*$'::"text", ''::"text"))) AS "nome_normalizado",
            true AS "fonte_ok"
           FROM ("public"."ingredients" "i"
             LEFT JOIN "fichas_me" "fme" ON (("fme"."ingredient_id" = "i"."id")))
          WHERE ("i"."ativo" = true)
        )
 SELECT "produtos"."tipo_item",
    "produtos"."subtipo",
    "produtos"."item_id",
    "produtos"."nome",
    "produtos"."categoria",
    "produtos"."tem_categoria",
    "produtos"."tem_preco",
    "produtos"."tem_custo",
    "produtos"."tem_ficha",
    "produtos"."eh_everest",
    "produtos"."camada_prontidao",
    "produtos"."peso_relevancia",
    "produtos"."nome_normalizado",
    "produtos"."fonte_ok"
   FROM "produtos"
UNION ALL
 SELECT "insumos"."tipo_item",
    "insumos"."subtipo",
    "insumos"."item_id",
    "insumos"."nome",
    "insumos"."categoria",
    "insumos"."tem_categoria",
    "insumos"."tem_preco",
    "insumos"."tem_custo",
    "insumos"."tem_ficha",
    "insumos"."eh_everest",
    "insumos"."camada_prontidao",
    "insumos"."peso_relevancia",
    "insumos"."nome_normalizado",
    "insumos"."fonte_ok"
   FROM "insumos";


ALTER VIEW "public"."v_cadastro_saude" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cmv_produto" WITH (security_invoker = true) AS
 WITH "base" AS (
         SELECT "menu_items"."id" AS "produto_id",
            "menu_items"."nome",
            "menu_items"."categoria",
            "menu_items"."preco_venda",
            "menu_items"."custo_total",
                CASE
                    WHEN (("menu_items"."preco_venda" >= (1)::numeric) AND ("menu_items"."custo_total" > (0)::numeric)) THEN "round"((("menu_items"."custo_total" / "menu_items"."preco_venda") * (100)::numeric), 2)
                    ELSE NULL::numeric
                END AS "cmv_teorico_pct",
            (("upper"("menu_items"."nome") ~ "similar_to_escape"('%(V[.] |VINHO|GIN |CHOPP|DOSE |WHISKY|WHISKEY|ESP[.] |ESP |ESPUMANTE|SAKE|CERVEJA|DRINQUE|COCKTAIL|DRINK|LICOR|CACHAÇA|CACHACA|CAIPIRINHA|VODKA|RUM |TEQUILA|CONHAQUE|PORTO|MALBEC|CHARDONNAY|CABERNET|MERLOT|PINOT|SYRAH|ROSE|ROSÉ|SAQUE|ÁGUA|AGUA |SUCO |REFRIGERANTE|RED BULL|ENERGETICO|KOMBUCHA|KEFIR)%'::"text")) OR ("menu_items"."categoria" = ANY (ARRAY['bebida_alcoolica'::"text", 'bebida_nao_alcoolica'::"text"]))) AS "eh_bebida"
           FROM "public"."menu_items"
          WHERE (("menu_items"."ativo" = true) AND ("menu_items"."is_subproduto" = false))
        )
 SELECT "produto_id",
    "nome",
    "categoria",
    "preco_venda",
    "custo_total",
    "cmv_teorico_pct",
        CASE
            WHEN (("preco_venda" >= (0)::numeric) AND ("preco_venda" < (1)::numeric)) THEN 'preco_lixo'::"text"
            WHEN (("preco_venda" >= (1)::numeric) AND (("custo_total" IS NULL) OR ("custo_total" <= (0)::numeric))) THEN 'sem_custo'::"text"
            WHEN (("cmv_teorico_pct" > (100)::numeric) AND (NOT "eh_bebida")) THEN 'margem_negativa'::"text"
            WHEN (("cmv_teorico_pct" > (100)::numeric) AND "eh_bebida") THEN 'erro_unidade_bebida'::"text"
            WHEN (("cmv_teorico_pct" >= (45)::numeric) AND ("cmv_teorico_pct" <= (100)::numeric)) THEN 'cmv_alto'::"text"
            WHEN ("cmv_teorico_pct" < (45)::numeric) THEN 'saudavel'::"text"
            ELSE NULL::"text"
        END AS "balde",
    "eh_bebida",
    (("preco_venda" >= (1)::numeric) AND ("custo_total" > (0)::numeric)) AS "fonte_ok"
   FROM "base";


ALTER VIEW "public"."v_cmv_produto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_despesa_canonica" WITH (security_invoker = true) AS
 WITH "base" AS (
         SELECT "dre_despesa_detalhada"."unit_id",
            "dre_despesa_detalhada"."mes_ano",
            COALESCE("dre_despesa_detalhada"."classificacao_dre", 'SEM CLASSIFICACAO'::character varying) AS "conta",
            "sum"("abs"("dre_despesa_detalhada"."valor")) AS "valor_caixa"
           FROM "public"."dre_despesa_detalhada"
          GROUP BY "dre_despesa_detalhada"."unit_id", "dre_despesa_detalhada"."mes_ano", COALESCE("dre_despesa_detalhada"."classificacao_dre", 'SEM CLASSIFICACAO'::character varying)
        ), "totais" AS (
         SELECT "base"."unit_id",
            "base"."mes_ano",
            "sum"("base"."valor_caixa") AS "total_mes"
           FROM "base"
          GROUP BY "base"."unit_id", "base"."mes_ano"
        ), "com_lag" AS (
         SELECT "b"."unit_id",
            "b"."mes_ano",
            "b"."conta",
            "b"."valor_caixa",
            "lag"("b"."valor_caixa") OVER (PARTITION BY "b"."unit_id", "b"."conta" ORDER BY ("to_date"(("b"."mes_ano")::"text", 'YYYY-MM'::"text"))) AS "valor_mes_anterior",
            "t"."total_mes"
           FROM ("base" "b"
             JOIN "totais" "t" USING ("unit_id", "mes_ano"))
        )
 SELECT "unit_id",
    "mes_ano",
    "conta",
    "round"("valor_caixa", 2) AS "valor_caixa",
    "round"("valor_mes_anterior", 2) AS "valor_mes_anterior",
        CASE
            WHEN (("valor_mes_anterior" IS NULL) OR ("valor_mes_anterior" = (0)::numeric)) THEN NULL::numeric
            ELSE "round"(((("valor_caixa" / "valor_mes_anterior") - (1)::numeric) * (100)::numeric), 1)
        END AS "variacao_pct",
    "round"((("valor_caixa" / NULLIF("total_mes", (0)::numeric)) * (100)::numeric), 1) AS "participacao_pct",
    true AS "fonte_ok"
   FROM "com_lag";


ALTER VIEW "public"."v_despesa_canonica" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_dre_canonico" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "dre_mensal"."unit_id",
            "dre_mensal"."mes_ano",
            "dre_mensal"."receita_bruta",
            "abs"("dre_mensal"."cmv") AS "cmv_rs",
            "abs"("dre_mensal"."pessoal") AS "pessoal_rs",
            ("abs"("dre_mensal"."cmv") + "abs"("dre_mensal"."pessoal")) AS "prime_cost_rs",
            "dre_mensal"."ebitda" AS "ebitda_rs",
            ("dre_mensal"."receita_bruta" IS NOT NULL) AS "fonte_ok"
           FROM "public"."dre_mensal"
          WHERE (("dre_mensal"."tipo")::"text" = 'realizado'::"text")
        ), "unpivoted" AS (
         SELECT "base"."unit_id",
            "base"."mes_ano",
            'cmv'::"text" AS "indicador",
            "base"."receita_bruta",
            "base"."cmv_rs" AS "realizado_rs",
            "round"((("base"."cmv_rs" / NULLIF("base"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "realizado_pct",
            "base"."fonte_ok"
           FROM "base"
        UNION ALL
         SELECT "base"."unit_id",
            "base"."mes_ano",
            'pessoal'::"text" AS "text",
            "base"."receita_bruta",
            "base"."pessoal_rs",
            "round"((("base"."pessoal_rs" / NULLIF("base"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "round",
            "base"."fonte_ok"
           FROM "base"
        UNION ALL
         SELECT "base"."unit_id",
            "base"."mes_ano",
            'prime_cost'::"text" AS "text",
            "base"."receita_bruta",
            "base"."prime_cost_rs",
            "round"((("base"."prime_cost_rs" / NULLIF("base"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "round",
            "base"."fonte_ok"
           FROM "base"
        UNION ALL
         SELECT "base"."unit_id",
            "base"."mes_ano",
            'ebitda'::"text" AS "text",
            "base"."receita_bruta",
            "base"."ebitda_rs",
            "round"((("base"."ebitda_rs" / NULLIF("base"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "round",
            "base"."fonte_ok"
           FROM "base"
        )
 SELECT "u"."unit_id",
    "u"."mes_ano",
    "u"."indicador",
    "u"."receita_bruta",
    "u"."realizado_pct",
    "u"."realizado_rs",
    "di"."valor" AS "meta_pct",
    "u"."fonte_ok"
   FROM ("unpivoted" "u"
     LEFT JOIN "public"."dre_indicadores" "di" ON ((("di"."unit_id" = "u"."unit_id") AND (("di"."mes_ano")::"text" = ("u"."mes_ano")::"text") AND (("di"."indicador")::"text" = "u"."indicador") AND (("di"."tipo")::"text" = 'orcado'::"text"))));


ALTER VIEW "public"."v_dre_canonico" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_dre_consolidado" WITH ("security_invoker"='true') AS
 SELECT "b"."id" AS "brand_id",
    "to_date"(((("split_part"(("d"."mes_ano")::"text", '-'::"text", 1) || '-'::"text") || "lpad"("split_part"(("d"."mes_ano")::"text", '-'::"text", 2), 2, '0'::"text")) || '-01'::"text"), 'YYYY-MM-DD'::"text") AS "competencia",
    "d"."receita_bruta",
    "d"."cmv",
    "round"((("abs"("d"."cmv") / NULLIF("d"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "cmv_pct",
    "d"."pessoal",
    "round"((("abs"("d"."pessoal") / NULLIF("d"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "pessoal_pct",
    ("abs"("d"."cmv") + "abs"("d"."pessoal")) AS "prime_cost",
    "round"(((("abs"("d"."cmv") + "abs"("d"."pessoal")) / NULLIF("d"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "prime_cost_pct",
    "d"."ebitda",
    "round"((("d"."ebitda" / NULLIF("d"."receita_bruta", (0)::numeric)) * (100)::numeric), 2) AS "ebitda_pct",
    "d"."ticket_medio",
    "d"."clientes"
   FROM (("public"."dre_mensal" "d"
     JOIN "public"."units" "u" ON (("d"."unit_id" = "u"."id")))
     JOIN "public"."brands" "b" ON (("u"."brand_id" = "b"."id")))
  WHERE (("d"."tipo")::"text" = 'realizado'::"text");


ALTER VIEW "public"."v_dre_consolidado" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_eventos_kpi" WITH ("security_invoker"='true') AS
 SELECT "e"."brand_id",
    "b"."name" AS "brand_name",
    "b"."color" AS "brand_color",
    "b"."slug" AS "brand_slug",
    "date_trunc"('month'::"text", "e"."data_inicio") AS "mes",
    "count"(*) AS "total_eventos",
    "count"(*) FILTER (WHERE ("e"."status" = 'aprovado'::"public"."event_status")) AS "eventos_aprovados",
    "count"(*) FILTER (WHERE ("e"."status" = 'em_andamento'::"public"."event_status")) AS "eventos_em_andamento",
    "count"(*) FILTER (WHERE ("e"."status" = 'concluido'::"public"."event_status")) AS "eventos_concluidos",
    "count"(*) FILTER (WHERE ("e"."status" = 'cancelado'::"public"."event_status")) AS "eventos_cancelados",
    "count"(*) FILTER (WHERE ("e"."status" = 'pendente_aprovacao'::"public"."event_status")) AS "eventos_pendentes",
    COALESCE("sum"("e"."valor_total") FILTER (WHERE ("e"."status" <> ALL (ARRAY['cancelado'::"public"."event_status", 'rascunho'::"public"."event_status"]))), (0)::numeric) AS "receita_prevista",
    COALESCE("sum"("e"."valor_total") FILTER (WHERE ("e"."status" = 'concluido'::"public"."event_status")), (0)::numeric) AS "receita_realizada",
    COALESCE("sum"("e"."num_convidados") FILTER (WHERE ("e"."status" <> ALL (ARRAY['cancelado'::"public"."event_status", 'rascunho'::"public"."event_status"]))), (0)::bigint) AS "total_convidados"
   FROM ("public"."events" "e"
     JOIN "public"."brands" "b" ON (("b"."id" = "e"."brand_id")))
  GROUP BY "e"."brand_id", "b"."name", "b"."color", "b"."slug", ("date_trunc"('month'::"text", "e"."data_inicio"));


ALTER VIEW "public"."v_eventos_kpi" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fonte_saude" WITH ("security_invoker"='true') AS
 WITH "fontes" AS (
         SELECT 'dre_mensal'::"text" AS "fonte",
            "max"("to_date"(("dre_mensal"."mes_ano")::"text", 'YYYY-MM'::"text")) AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY['dre-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."dre_mensal"
          WHERE (("dre_mensal"."tipo")::"text" = 'realizado'::"text")
        UNION ALL
         SELECT 'dre_despesa_detalhada'::"text" AS "fonte",
            "max"("to_date"(("dre_despesa_detalhada"."mes_ano")::"text", 'YYYY-MM'::"text")) AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY['despesa-caixa-auditor'::"text"] AS "auditores_afetados"
           FROM "public"."dre_despesa_detalhada"
        UNION ALL
         SELECT 'menu_items'::"text" AS "fonte",
            ("max"("menu_items"."updated_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY['cmv-produto-auditor'::"text", 'cadastro-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."menu_items"
          WHERE ("menu_items"."ativo" = true)
        UNION ALL
         SELECT 'ingredients'::"text" AS "fonte",
            ("max"("ingredients"."updated_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY['cmv-produto-auditor'::"text", 'cadastro-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."ingredients"
          WHERE ("ingredients"."ativo" = true)
        UNION ALL
         SELECT 'recipe_items'::"text" AS "fonte",
            ("max"("recipe_items"."updated_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY['cmv-produto-auditor'::"text", 'cadastro-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."recipe_items"
        UNION ALL
         SELECT 'gorjeta_distribuicao'::"text" AS "fonte",
            "max"("make_date"(("gorjeta_distribuicao"."ano")::integer, ("gorjeta_distribuicao"."mes")::integer, 1)) AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY['gorjetas-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."gorjeta_distribuicao"
        UNION ALL
         SELECT 'gorjeta_periodos'::"text" AS "fonte",
            "max"("gorjeta_periodos"."data") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY['gorjetas-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."gorjeta_periodos"
        UNION ALL
         SELECT 'receita_dias'::"text" AS "fonte",
            "max"("receita_dias"."data") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'diaria'::"text" AS "periodicidade_esperada",
            3 AS "limite_dias",
            ARRAY['receita-viva-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."receita_dias"
        UNION ALL
         SELECT 'job_openings'::"text" AS "fonte",
            ("max"("job_openings"."created_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY['recrutamento-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."job_openings"
        UNION ALL
         SELECT 'candidates'::"text" AS "fonte",
            ("max"("candidates"."created_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY['recrutamento-auditor-me'::"text"] AS "auditores_afetados"
           FROM "public"."candidates"
        UNION ALL
         SELECT 'titulos_a_pagar'::"text" AS "fonte",
            "max"(("titulos_a_pagar"."importado_em")::"date") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY[]::"text"[] AS "auditores_afetados"
           FROM "public"."titulos_a_pagar"
        UNION ALL
         SELECT 'ponto_mensal'::"text" AS "fonte",
            "max"(("ponto_mensal"."importado_em")::"date") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY[]::"text"[] AS "auditores_afetados"
           FROM "public"."ponto_mensal"
        UNION ALL
         SELECT 'purchase_orders'::"text" AS "fonte",
            "max"("purchase_orders"."data_pedido") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'semanal'::"text" AS "periodicidade_esperada",
            10 AS "limite_dias",
            ARRAY[]::"text"[] AS "auditores_afetados"
           FROM "public"."purchase_orders"
        UNION ALL
         SELECT 'employees'::"text" AS "fonte",
            ("max"("employees"."updated_at"))::"date" AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'eventual'::"text" AS "periodicidade_esperada",
            90 AS "limite_dias",
            ARRAY[]::"text"[] AS "auditores_afetados"
           FROM "public"."employees"
          WHERE ("employees"."ativo" = true)
        UNION ALL
         SELECT 'payslips'::"text" AS "fonte",
            "max"("payslips"."competencia") AS "ultima_escrita",
            ("count"(*))::integer AS "volume_total",
            'mensal'::"text" AS "periodicidade_esperada",
            45 AS "limite_dias",
            ARRAY[]::"text"[] AS "auditores_afetados"
           FROM "public"."payslips"
        )
 SELECT "fonte",
    "ultima_escrita",
    (CURRENT_DATE - "ultima_escrita") AS "dias_sem_atualizacao",
    "volume_total",
    "periodicidade_esperada",
    "limite_dias",
        CASE
            WHEN ((CURRENT_DATE - "ultima_escrita") <= "limite_dias") THEN 'viva'::"text"
            WHEN ((CURRENT_DATE - "ultima_escrita") <= ("limite_dias" * 2)) THEN 'atrasada'::"text"
            ELSE 'morta'::"text"
        END AS "status_fonte",
    "auditores_afetados"
   FROM "fontes"
  ORDER BY
        CASE
            WHEN ((CURRENT_DATE - "ultima_escrita") > ("limite_dias" * 2)) THEN 1
            WHEN ((CURRENT_DATE - "ultima_escrita") > "limite_dias") THEN 2
            ELSE 3
        END, ("array_length"("auditores_afetados", 1)) DESC NULLS LAST, (CURRENT_DATE - "ultima_escrita") DESC;


ALTER VIEW "public"."v_fonte_saude" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_gorjeta_periodo_dia" WITH (security_invoker = true) AS
 SELECT "unit_id",
    "data",
    "receita_bruta",
    "imposto_pct",
    "receita_liquida",
    "valor_ponto",
    "fonte"
   FROM "public"."gorjeta_periodos";


ALTER VIEW "public"."v_gorjeta_periodo_dia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_gorjeta_saude" WITH (security_invoker = true) AS
 SELECT "unit_id",
    "ano",
    "mes",
    "employee_id",
    "colaborador_id",
    "nome",
    "cargo",
    "dias_trabalhados",
    "pontuacao",
    "percentual",
    "valor_bruto",
    "valor_liquido",
    "recibo_gerado_at",
    "recibo_url",
    ("recibo_gerado_at" IS NOT NULL) AS "tem_recibo",
    (("pontuacao" > (0)::numeric) AND ("valor_bruto" = (0)::numeric)) AS "valor_zero_com_pontos",
    (("pontuacao" > (0)::numeric) AND ("valor_bruto" > (0)::numeric)) AS "fonte_ok"
   FROM "public"."gorjeta_distribuicao" "d";


ALTER VIEW "public"."v_gorjeta_saude" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_headcount_por_marca" WITH ("security_invoker"='true') AS
 SELECT "u"."brand_id",
    "b"."name" AS "brand_name",
    "b"."slug" AS "brand_slug",
    "count"(*) FILTER (WHERE ("emp"."ativo" = true)) AS "headcount_ativo",
    "count"(*) FILTER (WHERE (("emp"."ativo" = false) AND ("emp"."data_demissao" >= "date_trunc"('month'::"text", "now"())))) AS "demissoes_mes",
    "count"(*) FILTER (WHERE (("emp"."ativo" = true) AND ("emp"."data_admissao" >= "date_trunc"('month'::"text", "now"())))) AS "admissoes_mes",
    COALESCE("sum"("emp"."salario_base") FILTER (WHERE ("emp"."ativo" = true)), (0)::numeric) AS "folha_bruta"
   FROM (("public"."employees" "emp"
     JOIN "public"."units" "u" ON (("u"."id" = "emp"."unit_id")))
     JOIN "public"."brands" "b" ON (("b"."id" = "u"."brand_id")))
  GROUP BY "u"."brand_id", "b"."name", "b"."slug";


ALTER VIEW "public"."v_headcount_por_marca" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_proximos_eventos" WITH ("security_invoker"='true') AS
 SELECT "e"."id",
    "e"."nome",
    "e"."data_inicio",
    "e"."data_fim",
    "e"."status",
    "e"."num_convidados",
    "e"."valor_total",
    "e"."tipo",
    "e"."contato_cliente",
    "b"."name" AS "brand_name",
    "b"."color" AS "brand_color",
    "b"."slug" AS "brand_slug",
    "u"."name" AS "unit_name",
    ( SELECT "count"(*) AS "count"
           FROM "public"."event_menu_items" "mi"
          WHERE ("mi"."event_id" = "e"."id")) AS "total_itens_cardapio",
    ( SELECT "count"(*) AS "count"
           FROM "public"."event_staff" "es"
          WHERE ("es"."event_id" = "e"."id")) AS "total_equipe"
   FROM (("public"."events" "e"
     JOIN "public"."brands" "b" ON (("b"."id" = "e"."brand_id")))
     LEFT JOIN "public"."units" "u" ON (("u"."id" = "e"."unit_id")))
  WHERE (("e"."data_inicio" >= "now"()) AND ("e"."data_inicio" <= ("now"() + '30 days'::interval)) AND ("e"."status" <> ALL (ARRAY['cancelado'::"public"."event_status", 'rascunho'::"public"."event_status"])));


ALTER VIEW "public"."v_proximos_eventos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_receita_canonico" WITH ("security_invoker"='true') AS
 SELECT "data",
    "unit_id",
    "sum"("receita_bruta") AS "receita_bruta_dia",
    "sum"("receita_liquida") AS "receita_liquida_dia",
    "sum"("desconto") AS "desconto_dia",
    "sum"("gorjeta") AS "gorjeta_dia",
    "sum"("clientes") AS "clientes_dia",
    "round"(("sum"(("ticket_medio" * ("clientes")::numeric)) FILTER (WHERE ("ticket_medio" IS NOT NULL)) / (NULLIF("sum"("clientes") FILTER (WHERE ("ticket_medio" IS NOT NULL)), 0))::numeric), 2) AS "ticket_medio_dia",
        CASE
            WHEN ("sum"("clientes") > 0) THEN "round"(("sum"("receita_liquida") / ("sum"("clientes"))::numeric), 2)
            ELSE NULL::numeric
        END AS "ticket_real_dia",
    ("count"(*))::integer AS "n_turnos",
    (EXTRACT(dow FROM "data"))::integer AS "dia_semana",
    "to_char"(("data")::timestamp with time zone, 'Dy'::"text") AS "dia_semana_label",
    (("sum"("receita_bruta") > (0)::numeric) AND ("sum"("clientes") > 0)) AS "fonte_ok"
   FROM "public"."receita_dias" "rd"
  GROUP BY "data", "unit_id";


ALTER VIEW "public"."v_receita_canonico" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recrutamento_saude" WITH (security_invoker = true) AS
 SELECT "jo"."id" AS "vaga_id",
    COALESCE("jo"."cargo", "jo"."title") AS "cargo",
    "jo"."area",
    "jo"."unit_id",
    "jo"."status",
    "jo"."data_solicitacao",
    "jo"."prioridade",
    "jo"."recrutador",
        CASE
            WHEN ("jo"."data_solicitacao" IS NOT NULL) THEN (CURRENT_DATE - "jo"."data_solicitacao")
            ELSE NULL::integer
        END AS "dias_aberta",
    ("count"("c"."id"))::integer AS "n_candidatos",
    ("max"("c"."created_at"))::"date" AS "data_ultimo_candidato",
        CASE
            WHEN ("max"("c"."created_at") IS NOT NULL) THEN (CURRENT_DATE - ("max"("c"."created_at"))::"date")
            ELSE NULL::integer
        END AS "dias_sem_candidato",
        CASE
            WHEN ("jo"."area" ~~* '%cozinha%'::"text") THEN 45
            ELSE 30
        END AS "sla_area",
    ("jo"."data_solicitacao" IS NOT NULL) AS "fonte_ok"
   FROM ("public"."job_openings" "jo"
     LEFT JOIN "public"."candidates" "c" ON (("c"."job_opening_id" = "jo"."id")))
  GROUP BY "jo"."id", "jo"."cargo", "jo"."title", "jo"."area", "jo"."unit_id", "jo"."status", "jo"."data_solicitacao", "jo"."prioridade", "jo"."recrutador";


ALTER VIEW "public"."v_recrutamento_saude" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_vagas_pipeline" WITH (security_invoker = true) AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "brand_id",
    NULL::"uuid" AS "unit_id",
    NULL::"text" AS "title",
    NULL::"text" AS "description",
    NULL::boolean AS "is_active",
    NULL::"uuid" AS "created_by",
    NULL::timestamp with time zone AS "created_at",
    NULL::"text" AS "status",
    NULL::"text" AS "recrutador",
    NULL::integer AS "sla_dias",
    NULL::"text" AS "status_prazo",
    NULL::"text" AS "motivo",
    NULL::"text" AS "horario",
    NULL::numeric(10,2) AS "salario",
    NULL::"text" AS "fonte_recrutamento",
    NULL::"date" AS "data_admissao",
    NULL::"text" AS "candidato_aprovado",
    NULL::"date" AS "fechamento_previsto",
    NULL::"text" AS "observacoes",
    NULL::integer AS "dias_corridos",
    NULL::"text" AS "unit_name",
    NULL::"text" AS "brand_name",
    NULL::bigint AS "total_logs",
    NULL::timestamp with time zone AS "ultimo_log_em";


ALTER VIEW "public"."v_vagas_pipeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacation_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "total_dias" integer,
    "data_inicio" "date",
    "data_fim" "date",
    "data_retorno" "date",
    "status" "text" DEFAULT 'agendado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vacation_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "acquisitive_period_start" "date",
    "acquisitive_period_end" "date",
    "days_entitled" integer DEFAULT 30,
    "days_taken" integer,
    "abono_days" integer DEFAULT 0,
    "is_double_pay" boolean DEFAULT false,
    "status" "text" DEFAULT 'agendada'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vacations_status_check" CHECK (("status" = ANY (ARRAY['agendada'::"text", 'em_andamento'::"text", 'concluida'::"text", 'cancelada'::"text"])))
);


ALTER TABLE "public"."vacations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_ambiente" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "ambiente" "text" NOT NULL,
    "bruto" numeric,
    "clientes" integer,
    "participacao_pct" numeric
);


ALTER TABLE "public"."vendas_consolidado_ambiente" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_dia_semana" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "dia_semana" "text" NOT NULL,
    "ordem" integer,
    "bruto" numeric,
    "clientes" integer,
    "ticket_medio" numeric
);


ALTER TABLE "public"."vendas_consolidado_dia_semana" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_funcionarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "funcionario" "text" NOT NULL,
    "bruto" numeric,
    "qtd_vendas" integer
);


ALTER TABLE "public"."vendas_consolidado_funcionarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_mensal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "mes" "text" NOT NULL,
    "ordem" integer,
    "bruto" numeric,
    "liquido" numeric,
    "clientes" integer,
    "ticket_medio" numeric
);


ALTER TABLE "public"."vendas_consolidado_mensal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_periodo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "data_inicio" "date" NOT NULL,
    "data_fim" "date" NOT NULL,
    "label" "text" NOT NULL,
    "importado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vendas_consolidado_periodo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_produtos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "grupo" "text",
    "produto" "text" NOT NULL,
    "quantidade" numeric,
    "valor_bruto" numeric,
    "valor_desconto" numeric,
    "valor_liquido" numeric,
    "participacao_pct" numeric
);


ALTER TABLE "public"."vendas_consolidado_produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_resumo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "acessos" integer,
    "permanencia_media" "text",
    "ticket_medio" numeric,
    "ticket_real" numeric,
    "bruto" numeric,
    "produto" numeric,
    "custo" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "convite" numeric,
    "lucro" numeric,
    "entrada" numeric,
    "consumo" numeric,
    "devedor" numeric,
    "pgto_fechado" numeric,
    "pgto_recebido" numeric,
    "pgto_diferenca" numeric,
    "cash" numeric,
    "card" numeric,
    "pix" numeric
);


ALTER TABLE "public"."vendas_consolidado_resumo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_consolidado_turno" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodo_id" "uuid" NOT NULL,
    "turno" "text" NOT NULL,
    "bruto" numeric,
    "clientes" integer,
    "ticket_medio" numeric,
    "participacao_pct" numeric
);


ALTER TABLE "public"."vendas_consolidado_turno" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendas_diarias" (
    "id" integer NOT NULL,
    "data_venda" "date" NOT NULL,
    "turno" "text",
    "qtd_clientes" integer,
    "faturamento_bruto" numeric,
    "descontos_clientes" numeric,
    "descontos_socios" numeric,
    "descontos_internos" numeric,
    "gorjetas" numeric,
    "penduras" numeric,
    "perdas" numeric,
    "meta_faturamento" numeric,
    "criado_em" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendas_diarias" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."vendas_diarias_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vendas_diarias_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."vendas_diarias_id_seq" OWNED BY "public"."vendas_diarias"."id";



CREATE TABLE IF NOT EXISTS "public"."warnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "nivel" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "score_impact" integer DEFAULT 0,
    "documento_path" "text",
    "data" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."warnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "employee_id" "uuid",
    "nome" "text",
    "mes_referencia" "date",
    "escala_numero" integer,
    "departamento" "text",
    "cargo" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."work_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_caixas" (
    "caixa_id" integer NOT NULL,
    "workday_id" integer NOT NULL,
    "operador_nome" "text",
    "operador_cpf" "text",
    "abertura" "text",
    "fechamento" "text",
    "total_fechado" numeric,
    "total_recebido" numeric,
    "diferenca_total" numeric,
    "dinheiro_total" numeric,
    "despesa" numeric,
    "transacao" numeric,
    "pagamentos" "jsonb",
    "cedulas" "jsonb",
    "moedas" "jsonb"
);


ALTER TABLE "public"."workday_caixas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_grupos" (
    "id" integer NOT NULL,
    "workday_id" integer NOT NULL,
    "posicao" integer,
    "nome" "text",
    "percentual" numeric,
    "bruto" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "consumo" numeric
);


ALTER TABLE "public"."workday_grupos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_produtos" (
    "id" integer NOT NULL,
    "workday_id" integer NOT NULL,
    "posicao" integer,
    "nome" "text",
    "qtde" numeric,
    "unitario" numeric,
    "cmv_pct" numeric,
    "custo" numeric,
    "lucro" numeric,
    "consumo" numeric
);


ALTER TABLE "public"."workday_produtos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_resumo" (
    "workday_id" integer NOT NULL,
    "data" "date" NOT NULL,
    "unidade_id" integer NOT NULL,
    "acessos" integer,
    "permanencia" "text",
    "cmv_pct" numeric,
    "ticket_zero" numeric,
    "ticket_real" numeric,
    "ticket_medio" numeric,
    "bruto" numeric,
    "desconto" numeric,
    "gorjeta" numeric,
    "custo" numeric,
    "despesa" numeric,
    "lucro" numeric,
    "convite" numeric,
    "produto" numeric,
    "consumo_total" numeric,
    "devedor_total" numeric,
    "pendencia_antiga" numeric,
    "total_fechado" numeric,
    "total_recebido" numeric,
    "diferenca_caixa" numeric,
    "diferenca_real" numeric,
    "cancelamentos_total" numeric,
    "descontos_total" numeric,
    "pagamentos" "jsonb",
    "caixas" "jsonb",
    "ambientes" "jsonb",
    "turnos" "jsonb",
    "clientes_tipo" "jsonb",
    "clientes_sexo" "jsonb",
    "clientes_idade" "jsonb",
    "cidades" "jsonb",
    "devedores" "jsonb",
    "pendencias_antigas" "jsonb",
    "gorjetas_edit" "jsonb",
    "descontos_motivo" "jsonb",
    "cancelamentos_motivo" "jsonb",
    "cancelamentos_usuario" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workday_resumo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_usuarios" (
    "id" integer NOT NULL,
    "workday_id" integer NOT NULL,
    "posicao" integer,
    "nome" "text",
    "qtde" numeric,
    "gorjeta" numeric,
    "convite" numeric,
    "produto" numeric,
    "consumo" numeric
);


ALTER TABLE "public"."workday_usuarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workday_venda" (
    "workday_id" integer NOT NULL,
    "data" "date" NOT NULL,
    "bruto_total" numeric,
    "desconto_total" numeric,
    "gorjeta_total" numeric,
    "total" numeric,
    "categorias" "jsonb"
);


ALTER TABLE "public"."workday_venda" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auditoria_nutricional" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."auditoria_nutricional_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_contratos_fixos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_contratos_fixos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_despesa_detalhada" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_despesa_detalhada_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_faturamento_historico" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_faturamento_historico_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_folha" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_folha_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_gorjeta_mensal" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_gorjeta_mensal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_indicadores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_indicadores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_linhas_detalhadas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_linhas_detalhadas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_manutencao_detalhada" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_manutencao_detalhada_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_mensal" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_mensal_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_pessoal_detalhado" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_pessoal_detalhado_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_prestadores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_prestadores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."dre_receita_detalhada" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."dre_receita_detalhada_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lancamentos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lancamentos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."metas_projecoes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."metas_projecoes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."movimentacoes_caixa" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."movimentacoes_caixa_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."nfe_documentos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."nfe_documentos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas_detalhadas" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notas_detalhadas_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notas_nutri" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notas_nutri_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."produtos_relatorio" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."produtos_relatorio_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."recebiveis_cartao" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."recebiveis_cartao_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."relatorio_produtos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."relatorio_produtos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."vendas_diarias" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."vendas_diarias_id_seq"'::"regclass");



ALTER TABLE ONLY "mise"."checklist_action_plans"
    ADD CONSTRAINT "checklist_action_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."checklist_executions"
    ADD CONSTRAINT "checklist_execucoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."checklist_execution_topicos"
    ADD CONSTRAINT "checklist_execution_topicos_execution_id_topico_ordem_key" UNIQUE ("execution_id", "topico_ordem");



ALTER TABLE ONLY "mise"."checklist_execution_topicos"
    ADD CONSTRAINT "checklist_execution_topicos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."checklist_responses"
    ADD CONSTRAINT "checklist_responses_execution_id_item_id_key" UNIQUE ("execution_id", "item_id");



ALTER TABLE ONLY "mise"."checklist_responses"
    ADD CONSTRAINT "checklist_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."checklist_template_items"
    ADD CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."crivo_locais"
    ADD CONSTRAINT "crivo_locais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."debug_responder"
    ADD CONSTRAINT "debug_responder_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."ingredient_shelf_life"
    ADD CONSTRAINT "ingredient_shelf_life_ingredient_id_metodo_conservacao_key" UNIQUE ("ingredient_id", "metodo_conservacao");



ALTER TABLE ONLY "mise"."ingredient_shelf_life"
    ADD CONSTRAINT "ingredient_shelf_life_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."inventory_count_items"
    ADD CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."print_points"
    ADD CONSTRAINT "print_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."production_orders"
    ADD CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."receiving_items"
    ADD CONSTRAINT "receiving_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."receiving_records"
    ADD CONSTRAINT "receiving_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."responsaveis"
    ADD CONSTRAINT "responsaveis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."responsavel_unidades"
    ADD CONSTRAINT "responsavel_unidades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."responsavel_unidades"
    ADD CONSTRAINT "responsavel_unidades_responsavel_id_unit_id_key" UNIQUE ("responsavel_id", "unit_id");



ALTER TABLE ONLY "mise"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."shelf_life_rules"
    ADD CONSTRAINT "shelf_life_rules_categoria_metodo_conservacao_key" UNIQUE ("categoria", "metodo_conservacao");



ALTER TABLE ONLY "mise"."shelf_life_rules"
    ADD CONSTRAINT "shelf_life_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."user_pins"
    ADD CONSTRAINT "user_pins_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "mise"."user_pins"
    ADD CONSTRAINT "user_pins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "mise"."waste_records"
    ADD CONSTRAINT "waste_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "opx"."event"
    ADD CONSTRAINT "event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "opx"."evidence"
    ADD CONSTRAINT "evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Comments"
    ADD CONSTRAINT "Comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Projects"
    ADD CONSTRAINT "Projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Task_Assignees"
    ADD CONSTRAINT "Task_Assignees_pkey" PRIMARY KEY ("task_id", "member_id");



ALTER TABLE ONLY "public"."Tasks"
    ADD CONSTRAINT "Tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Team_Members"
    ADD CONSTRAINT "Team_Members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_plan_tasks"
    ADD CONSTRAINT "action_plan_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_conversations"
    ADD CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_metrics"
    ADD CONSTRAINT "agent_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_prompt_versions"
    ADD CONSTRAINT "agent_prompt_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_runs"
    ADD CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_summaries"
    ADD CONSTRAINT "attendance_summaries_employee_id_periodo_inicio_periodo_fim_key" UNIQUE ("employee_id", "periodo_inicio", "periodo_fim");



ALTER TABLE ONLY "public"."attendance_summaries"
    ADD CONSTRAINT "attendance_summaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auditoria_nutricional"
    ADD CONSTRAINT "auditoria_nutricional_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_rate_limits"
    ADD CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("identifier_hash", "action");



ALTER TABLE ONLY "public"."avaliacao_ciclos"
    ADD CONSTRAINT "avaliacao_ciclos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_participantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_unica" UNIQUE ("ciclo_id", "avaliado_id", "avaliador_id");



ALTER TABLE ONLY "public"."brand_links"
    ADD CONSTRAINT "brand_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brand_targets"
    ADD CONSTRAINT "brand_targets_brand_id_periodo_key" UNIQUE ("brand_id", "periodo");



ALTER TABLE ONLY "public"."brand_targets"
    ADD CONSTRAINT "brand_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_feedback_operacional"
    ADD CONSTRAINT "cand_feedback_op_unique" UNIQUE ("candidate_id");



ALTER TABLE ONLY "public"."candidate_agendamentos"
    ADD CONSTRAINT "candidate_agendamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_avaliacao"
    ADD CONSTRAINT "candidate_avaliacao_candidate_id_key" UNIQUE ("candidate_id");



ALTER TABLE ONLY "public"."candidate_avaliacao"
    ADD CONSTRAINT "candidate_avaliacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_feedback_operacional"
    ADD CONSTRAINT "candidate_feedback_operacional_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_pipeline"
    ADD CONSTRAINT "candidate_pipeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_access_code_key" UNIQUE ("access_code");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidatos_maya"
    ADD CONSTRAINT "candidatos_maya_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargo_grupos"
    ADD CONSTRAINT "cargo_grupos_nome_key" UNIQUE ("nome");



ALTER TABLE ONLY "public"."cargo_grupos"
    ADD CONSTRAINT "cargo_grupos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargo_salarios"
    ADD CONSTRAINT "cargo_salarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_nome_unique" UNIQUE ("nome");



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cct_versions"
    ADD CONSTRAINT "cct_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_records"
    ADD CONSTRAINT "checklist_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_interactions"
    ADD CONSTRAINT "client_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_questions"
    ADD CONSTRAINT "climate_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_responses"
    ADD CONSTRAINT "climate_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_responses"
    ADD CONSTRAINT "climate_responses_question_id_employee_id_key" UNIQUE ("question_id", "employee_id");



ALTER TABLE ONLY "public"."climate_survey_questions"
    ADD CONSTRAINT "climate_survey_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_surveys"
    ADD CONSTRAINT "climate_surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conferencias"
    ADD CONSTRAINT "conferencias_alerta_chave_unit_id_competencia_key" UNIQUE ("alerta_chave", "unit_id", "competencia");



ALTER TABLE ONLY "public"."conferencias"
    ADD CONSTRAINT "conferencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contas_bancarias"
    ADD CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contatos_kph"
    ADD CONSTRAINT "contatos_kph_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contatos_kph"
    ADD CONSTRAINT "contatos_kph_telefone_key" UNIQUE ("telefone");



ALTER TABLE ONLY "public"."contractor_payments"
    ADD CONSTRAINT "contractor_payments_contractor_id_unit_id_competencia_key" UNIQUE ("contractor_id", "unit_id", "competencia");



ALTER TABLE ONLY "public"."contractor_payments"
    ADD CONSTRAINT "contractor_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractor_vacations"
    ADD CONSTRAINT "contractor_vacations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contractors"
    ADD CONSTRAINT "contractors_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."contractors"
    ADD CONSTRAINT "contractors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contratos_arquivos"
    ADD CONSTRAINT "contratos_arquivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contratos"
    ADD CONSTRAINT "contratos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dependents"
    ADD CONSTRAINT "dependents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dho_tracking"
    ADD CONSTRAINT "dho_tracking_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disc_profiles"
    ADD CONSTRAINT "disc_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."disciplinary_actions"
    ADD CONSTRAINT "disciplinary_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_nome_unidade_key" UNIQUE ("nome", "unidade");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_contratos_fixos"
    ADD CONSTRAINT "dre_contratos_fixos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_despesa_detalhada"
    ADD CONSTRAINT "dre_despesa_detalhada_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_faturamento_historico"
    ADD CONSTRAINT "dre_faturamento_historico_mes_num_categoria_unit_id_key" UNIQUE ("mes_num", "categoria", "unit_id");



ALTER TABLE ONLY "public"."dre_faturamento_historico"
    ADD CONSTRAINT "dre_faturamento_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_folha"
    ADD CONSTRAINT "dre_folha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_gorjeta_mensal"
    ADD CONSTRAINT "dre_gorjeta_mensal_mes_ano_unit_id_key" UNIQUE ("mes_ano", "unit_id");



ALTER TABLE ONLY "public"."dre_gorjeta_mensal"
    ADD CONSTRAINT "dre_gorjeta_mensal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_indicadores"
    ADD CONSTRAINT "dre_indicadores_mes_ano_tipo_indicador_unit_key" UNIQUE ("mes_ano", "tipo", "indicador", "unit_id");



ALTER TABLE ONLY "public"."dre_indicadores"
    ADD CONSTRAINT "dre_indicadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_kpis_mensais"
    ADD CONSTRAINT "dre_kpis_mensais_pkey" PRIMARY KEY ("mes_ano", "unit_id");



ALTER TABLE ONLY "public"."dre_linhas_detalhadas"
    ADD CONSTRAINT "dre_linhas_detalhadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_manutencao_detalhada"
    ADD CONSTRAINT "dre_manutencao_detalhada_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_mensal"
    ADD CONSTRAINT "dre_mensal_mes_ano_tipo_unit_key" UNIQUE ("mes_ano", "tipo", "unit_id");



ALTER TABLE ONLY "public"."dre_mensal"
    ADD CONSTRAINT "dre_mensal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_pessoal_detalhado"
    ADD CONSTRAINT "dre_pessoal_detalhado_mes_ano_categoria_unit_id_key" UNIQUE ("mes_ano", "categoria", "unit_id");



ALTER TABLE ONLY "public"."dre_pessoal_detalhado"
    ADD CONSTRAINT "dre_pessoal_detalhado_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_prestadores"
    ADD CONSTRAINT "dre_prestadores_mes_ano_nome_grupo_unit_id_key" UNIQUE ("mes_ano", "nome", "grupo", "unit_id");



ALTER TABLE ONLY "public"."dre_prestadores"
    ADD CONSTRAINT "dre_prestadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_receita_detalhada"
    ADD CONSTRAINT "dre_receita_detalhada_mes_ano_bandeira_unit_id_key" UNIQUE ("mes_ano", "bandeira", "unit_id");



ALTER TABLE ONLY "public"."dre_receita_detalhada"
    ADD CONSTRAINT "dre_receita_detalhada_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dre_snapshot"
    ADD CONSTRAINT "dre_snapshot_pkey" PRIMARY KEY ("unit_id", "competencia", "conta_codigo");



ALTER TABLE ONLY "public"."employee_auth"
    ADD CONSTRAINT "employee_auth_cpf_key" UNIQUE ("cpf");



ALTER TABLE ONLY "public"."employee_auth"
    ADD CONSTRAINT "employee_auth_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_employee_id_data_key" UNIQUE ("employee_id", "data");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_employee_id_tipo_competencia_key" UNIQUE ("employee_id", "tipo", "competencia");



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_codigos_dominio"
    ADD CONSTRAINT "employee_codigos_dominio_pkey" PRIMARY KEY ("employee_id", "unit_id");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_cpf_key" UNIQUE ("cpf");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_attachments"
    ADD CONSTRAINT "event_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_infra_items"
    ADD CONSTRAINT "event_infra_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_menu_items"
    ADD CONSTRAINT "event_menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_staff"
    ADD CONSTRAINT "event_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_status_log"
    ADD CONSTRAINT "event_status_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_importacoes"
    ADD CONSTRAINT "financeiro_importacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financeiro_importacoes"
    ADD CONSTRAINT "financeiro_importacoes_unit_id_checksum_sha256_key" UNIQUE ("unit_id", "checksum_sha256");



ALTER TABLE ONLY "public"."financeiro_revisoes"
    ADD CONSTRAINT "financeiro_revisoes_pkey" PRIMARY KEY ("unit_id");



ALTER TABLE ONLY "public"."folha_empresa"
    ADD CONSTRAINT "folha_empresa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folha_empresa"
    ADD CONSTRAINT "folha_empresa_unit_id_competencia_etapa_nome_chave_key" UNIQUE ("unit_id", "competencia", "etapa", "nome_chave");



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."fornecedores_depara"
    ADD CONSTRAINT "fornecedores_depara_nome_origem_origem_key" UNIQUE ("nome_origem", "origem");



ALTER TABLE ONLY "public"."fornecedores_depara"
    ADD CONSTRAINT "fornecedores_depara_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fornecedores"
    ADD CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gorjeta_cargo_pontos"
    ADD CONSTRAINT "gorjeta_cargo_pontos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gorjeta_cargo_pontos"
    ADD CONSTRAINT "gorjeta_cargo_pontos_unit_id_cargo_key" UNIQUE ("unit_id", "cargo");



ALTER TABLE ONLY "public"."gorjeta_dias"
    ADD CONSTRAINT "gorjeta_dias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gorjeta_dias"
    ADD CONSTRAINT "gorjeta_dias_unit_id_employee_id_data_key" UNIQUE ("unit_id", "employee_id", "data");



ALTER TABLE ONLY "public"."gorjeta_distribuicao"
    ADD CONSTRAINT "gorjeta_distribuicao_periodo_emp_uq" UNIQUE ("unit_id", "periodo", "employee_id");



ALTER TABLE ONLY "public"."gorjeta_distribuicao"
    ADD CONSTRAINT "gorjeta_distribuicao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gorjeta_periodos"
    ADD CONSTRAINT "gorjeta_periodos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gorjeta_periodos"
    ADD CONSTRAINT "gorjeta_periodos_unit_id_data_key" UNIQUE ("unit_id", "data");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."hos_approvals"
    ADD CONSTRAINT "hos_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hos_insights"
    ADD CONSTRAINT "hos_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hos_jobs"
    ADD CONSTRAINT "hos_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hos_jobs"
    ADD CONSTRAINT "hos_jobs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."hos_runs"
    ADD CONSTRAINT "hos_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hour_bank"
    ADD CONSTRAINT "hour_bank_employee_id_competencia_key" UNIQUE ("employee_id", "competencia");



ALTER TABLE ONLY "public"."hour_bank"
    ADD CONSTRAINT "hour_bank_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hr_policies"
    ADD CONSTRAINT "hr_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_price_history"
    ADD CONSTRAINT "ingredient_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_stock"
    ADD CONSTRAINT "ingredient_stock_ingredient_id_unit_id_key" UNIQUE ("ingredient_id", "unit_id");



ALTER TABLE ONLY "public"."ingredient_stock"
    ADD CONSTRAINT "ingredient_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_job_opening_id_order_num_key" UNIQUE ("job_opening_id", "order_num");



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interview_responses"
    ADD CONSTRAINT "interview_responses_candidate_id_question_id_key" UNIQUE ("candidate_id", "question_id");



ALTER TABLE ONLY "public"."interview_responses"
    ADD CONSTRAINT "interview_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_opening_logs"
    ADD CONSTRAINT "job_opening_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_requisitions"
    ADD CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kph_alerts"
    ADD CONSTRAINT "kph_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kph_insights"
    ADD CONSTRAINT "kph_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kph_intelligence_scores"
    ADD CONSTRAINT "kph_intelligence_scores_modulo_semana_key" UNIQUE ("modulo", "semana");



ALTER TABLE ONLY "public"."kph_intelligence_scores"
    ADD CONSTRAINT "kph_intelligence_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kph_learning_proposals"
    ADD CONSTRAINT "kph_learning_proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_snapshot"
    ADD CONSTRAINT "kpi_snapshot_pkey" PRIMARY KEY ("unit_id", "competencia");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_machine_reports"
    ADD CONSTRAINT "learning_machine_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_machine_reports"
    ADD CONSTRAINT "learning_machine_reports_week_number_year_key" UNIQUE ("week_number", "year");



ALTER TABLE ONLY "public"."manutencao_aprovacoes"
    ADD CONSTRAINT "manutencao_aprovacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manutencao_chamados"
    ADD CONSTRAINT "manutencao_chamados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manutencao_parcelas"
    ADD CONSTRAINT "manutencao_parcelas_aprovacao_id_numero_key" UNIQUE ("aprovacao_id", "numero");



ALTER TABLE ONLY "public"."manutencao_parcelas"
    ADD CONSTRAINT "manutencao_parcelas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mapa_conta_dre"
    ADD CONSTRAINT "mapa_conta_dre_descricao_c_gerencial_key" UNIQUE ("descricao_c_gerencial");



ALTER TABLE ONLY "public"."mapa_conta_dre"
    ADD CONSTRAINT "mapa_conta_dre_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_dia_override"
    ADD CONSTRAINT "metas_dia_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_dia_override"
    ADD CONSTRAINT "metas_dia_override_unit_id_data_key" UNIQUE ("unit_id", "data");



ALTER TABLE ONLY "public"."metas_dia_semana"
    ADD CONSTRAINT "metas_dia_semana_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_dia_semana"
    ADD CONSTRAINT "metas_dia_semana_unit_id_dia_semana_key" UNIQUE ("unit_id", "dia_semana");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas_projecoes"
    ADD CONSTRAINT "metas_projecoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_unit_id_competencia_chave_key" UNIQUE ("unit_id", "competencia", "chave");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_origem_origem_id_key" UNIQUE ("origem", "origem_id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."movimentacoes_rh"
    ADD CONSTRAINT "movimentacoes_rh_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfe_documentos"
    ADD CONSTRAINT "nfe_documentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nfe_documentos"
    ADD CONSTRAINT "nfe_documentos_unit_id_chave_key" UNIQUE ("unit_id", "chave");



ALTER TABLE ONLY "public"."nfe_importacoes"
    ADD CONSTRAINT "nfe_importacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_detalhadas"
    ADD CONSTRAINT "notas_detalhadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notas_nutri"
    ADD CONSTRAINT "notas_nutri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orkestri_achados"
    ADD CONSTRAINT "oa_unico" UNIQUE ("auditor", "unit_id", "periodo", "indicador", "tipo");



ALTER TABLE ONLY "public"."occupational_health"
    ADD CONSTRAINT "occupational_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_runs"
    ADD CONSTRAINT "onboarding_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_tarefas"
    ADD CONSTRAINT "onboarding_tarefas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_templates"
    ADD CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."origens_candidato"
    ADD CONSTRAINT "origens_candidato_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."origens_candidato"
    ADD CONSTRAINT "origens_candidato_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orkestri_achados"
    ADD CONSTRAINT "orkestri_achados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orkestri_leads"
    ADD CONSTRAINT "orkestri_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orquestrador_jobs"
    ADD CONSTRAINT "orquestrador_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."overtime_records"
    ADD CONSTRAINT "overtime_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_dominio_cadastro"
    ADD CONSTRAINT "payroll_dominio_cadastro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_dominio_cargo"
    ADD CONSTRAINT "payroll_dominio_cargo_pkey" PRIMARY KEY ("cargo_codigo");



ALTER TABLE ONLY "public"."payroll_dominio_empresa"
    ADD CONSTRAINT "payroll_dominio_empresa_pkey" PRIMARY KEY ("cod_empresa");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_colaborador"
    ADD CONSTRAINT "payroll_extrato_dominio_colaborador_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_competencia"
    ADD CONSTRAINT "payroll_extrato_dominio_competencia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_competencia"
    ADD CONSTRAINT "payroll_extrato_dominio_competencia_unit_id_competencia_key" UNIQUE ("unit_id", "competencia");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_linha"
    ADD CONSTRAINT "payroll_extrato_dominio_linha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_rubrica"
    ADD CONSTRAINT "payroll_extrato_dominio_rubrica_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_totais"
    ADD CONSTRAINT "payroll_extrato_dominio_totais_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_fechamento_linha"
    ADD CONSTRAINT "payroll_fechamento_linha_periodo_id_employee_id_rubrica_id_key" UNIQUE ("periodo_id", "employee_id", "rubrica_id");



ALTER TABLE ONLY "public"."payroll_fechamento_linha"
    ADD CONSTRAINT "payroll_fechamento_linha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_fechamento_periodo"
    ADD CONSTRAINT "payroll_fechamento_periodo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_fechamento_periodo"
    ADD CONSTRAINT "payroll_fechamento_periodo_unit_id_competencia_tipo_process_key" UNIQUE ("unit_id", "competencia", "tipo_processo");



ALTER TABLE ONLY "public"."payroll_rubricas"
    ADD CONSTRAINT "payroll_rubricas_cod_kph_key" UNIQUE ("cod_kph");



ALTER TABLE ONLY "public"."payroll_rubricas"
    ADD CONSTRAINT "payroll_rubricas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_emp_comp_tipo_key" UNIQUE ("employee_id", "competencia", "tipo");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pdi_metas"
    ADD CONSTRAINT "pdi_metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_templates"
    ADD CONSTRAINT "performance_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_members"
    ADD CONSTRAINT "plan_members_pkey" PRIMARY KEY ("plan_id", "member_id");



ALTER TABLE ONLY "public"."plano_contas"
    ADD CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("codigo");



ALTER TABLE ONLY "public"."ponto_mensal"
    ADD CONSTRAINT "ponto_mensal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ponto_mensal"
    ADD CONSTRAINT "ponto_mensal_unit_id_periodo_matricula_key" UNIQUE ("unit_id", "periodo", "matricula");



ALTER TABLE ONLY "public"."price_quote_items"
    ADD CONSTRAINT "price_quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_catalogo"
    ADD CONSTRAINT "produtos_catalogo_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."produtos_catalogo"
    ADD CONSTRAINT "produtos_catalogo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_depara"
    ADD CONSTRAINT "produtos_depara_fornecedor_item_key" UNIQUE ("fornecedor_cnpj", "item_codigo");



ALTER TABLE ONLY "public"."produtos_depara"
    ADD CONSTRAINT "produtos_depara_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."produtos_relatorio"
    ADD CONSTRAINT "produtos_relatorio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_invites"
    ADD CONSTRAINT "project_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_invites"
    ADD CONSTRAINT "project_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protestos_certidoes"
    ADD CONSTRAINT "protestos_certidoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protestos_registros"
    ADD CONSTRAINT "protestos_registros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."punch_adjustment_requests"
    ADD CONSTRAINT "punch_adjustment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoice_items"
    ADD CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_unit_id_numero_danfe_key" UNIQUE ("unit_id", "numero_danfe");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quadro_ideal"
    ADD CONSTRAINT "quadro_ideal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quality_checklists"
    ADD CONSTRAINT "quality_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recebimento_itens"
    ADD CONSTRAINT "recebimento_itens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recebimentos"
    ADD CONSTRAINT "recebimentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recebiveis_cartao"
    ADD CONSTRAINT "recebiveis_cartao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_ambientes"
    ADD CONSTRAINT "receita_ambientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_caixas"
    ADD CONSTRAINT "receita_caixas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_cancelamentos_detalhe"
    ADD CONSTRAINT "receita_cancelamentos_detalhe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_cancelamentos"
    ADD CONSTRAINT "receita_cancelamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_descontos_detalhe"
    ADD CONSTRAINT "receita_descontos_detalhe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_descontos"
    ADD CONSTRAINT "receita_descontos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_dias"
    ADD CONSTRAINT "receita_dias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_dias"
    ADD CONSTRAINT "receita_dias_unit_id_workday_id_key" UNIQUE ("unit_id", "workday_id");



ALTER TABLE ONLY "public"."receita_grupos"
    ADD CONSTRAINT "receita_grupos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_horarios"
    ADD CONSTRAINT "receita_horarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_import_log"
    ADD CONSTRAINT "receita_import_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_pagamentos"
    ADD CONSTRAINT "receita_pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_produtos_dia"
    ADD CONSTRAINT "receita_produtos_dia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_turnos"
    ADD CONSTRAINT "receita_turnos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receita_usuarios"
    ADD CONSTRAINT "receita_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_items"
    ADD CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipe_notes"
    ADD CONSTRAINT "recipe_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliacoes_sugeridas"
    ADD CONSTRAINT "reconciliacoes_sugeridas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliacoes_sugeridas"
    ADD CONSTRAINT "reconciliacoes_sugeridas_titulo_id_chave_nfe_key" UNIQUE ("titulo_id", "chave_nfe");



ALTER TABLE ONLY "public"."regras_classificacao"
    ADD CONSTRAINT "regras_classificacao_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."relatorio_produtos"
    ADD CONSTRAINT "relatorio_produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reuniao_action_items"
    ADD CONSTRAINT "reuniao_action_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reunioes_1on1"
    ADD CONSTRAINT "reunioes_1on1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmap_items"
    ADD CONSTRAINT "roadmap_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_events"
    ADD CONSTRAINT "score_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_employee_id_data_key" UNIQUE ("employee_id", "data");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sick_leaves"
    ADD CONSTRAINT "sick_leaves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."target_notes"
    ADD CONSTRAINT "target_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id", "member_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminations"
    ADD CONSTRAINT "terminations_employee_id_tipo_aviso_data_aviso_key" UNIQUE ("employee_id", "tipo_aviso", "data_aviso");



ALTER TABLE ONLY "public"."terminations"
    ADD CONSTRAINT "terminations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."theo_tickets"
    ADD CONSTRAINT "theo_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_bank_balance"
    ADD CONSTRAINT "time_bank_balance_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."time_bank_balance"
    ADD CONSTRAINT "time_bank_balance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_clock_punches"
    ADD CONSTRAINT "time_clock_punches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."titulo_override"
    ADD CONSTRAINT "titulo_override_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."titulo_override"
    ADD CONSTRAINT "titulo_override_titulo_id_key" UNIQUE ("titulo_id");



ALTER TABLE ONLY "public"."titulo_pagamentos"
    ADD CONSTRAINT "titulo_pagamentos_pedido_id_key" UNIQUE ("pedido_id");



ALTER TABLE ONLY "public"."titulo_pagamentos"
    ADD CONSTRAINT "titulo_pagamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."titulos_a_pagar"
    ADD CONSTRAINT "titulos_a_pagar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_employee_id_template_id_key" UNIQUE ("employee_id", "template_id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_templates"
    ADD CONSTRAINT "training_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transport_vouchers"
    ADD CONSTRAINT "transport_vouchers_employee_id_periodo_key" UNIQUE ("employee_id", "periodo");



ALTER TABLE ONLY "public"."transport_vouchers"
    ADD CONSTRAINT "transport_vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uniforms"
    ADD CONSTRAINT "uniforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_cnpjs"
    ADD CONSTRAINT "unit_cnpjs_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."unit_cnpjs"
    ADD CONSTRAINT "unit_cnpjs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_dominio_cadastro"
    ADD CONSTRAINT "uq_dom_cadastro" UNIQUE ("cod_empresa", "cod_colaborador");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_colaborador"
    ADD CONSTRAINT "uq_extrato_colab" UNIQUE ("unit_id", "competencia", "cod_colaborador");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_linha"
    ADD CONSTRAINT "uq_extrato_linha" UNIQUE ("unit_id", "competencia", "cod_colaborador", "rubrica_codigo");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_rubrica"
    ADD CONSTRAINT "uq_extrato_rubrica" UNIQUE ("unit_id", "competencia", "rubrica_codigo", "natureza");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_totais"
    ADD CONSTRAINT "uq_extrato_totais" UNIQUE ("unit_id", "competencia", "dimensao", "codigo");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_id_unit_id_key" UNIQUE ("user_id", "role_id", "unit_id");



ALTER TABLE ONLY "public"."vacation_schedules"
    ADD CONSTRAINT "vacation_schedules_employee_id_data_inicio_key" UNIQUE ("employee_id", "data_inicio");



ALTER TABLE ONLY "public"."vacation_schedules"
    ADD CONSTRAINT "vacation_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_ambiente"
    ADD CONSTRAINT "vendas_consolidado_ambiente_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_dia_semana"
    ADD CONSTRAINT "vendas_consolidado_dia_semana_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_funcionarios"
    ADD CONSTRAINT "vendas_consolidado_funcionarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_mensal"
    ADD CONSTRAINT "vendas_consolidado_mensal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_periodo"
    ADD CONSTRAINT "vendas_consolidado_periodo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_produtos"
    ADD CONSTRAINT "vendas_consolidado_produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_resumo"
    ADD CONSTRAINT "vendas_consolidado_resumo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_consolidado_turno"
    ADD CONSTRAINT "vendas_consolidado_turno_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendas_diarias"
    ADD CONSTRAINT "vendas_diarias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warnings"
    ADD CONSTRAINT "warnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_employee_id_mes_referencia_key" UNIQUE ("employee_id", "mes_referencia");



ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workday_caixas"
    ADD CONSTRAINT "workday_caixas_pkey" PRIMARY KEY ("caixa_id");



ALTER TABLE ONLY "public"."workday_grupos"
    ADD CONSTRAINT "workday_grupos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workday_produtos"
    ADD CONSTRAINT "workday_produtos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workday_resumo"
    ADD CONSTRAINT "workday_resumo_pkey" PRIMARY KEY ("workday_id");



ALTER TABLE ONLY "public"."workday_usuarios"
    ADD CONSTRAINT "workday_usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workday_venda"
    ADD CONSTRAINT "workday_venda_pkey" PRIMARY KEY ("workday_id");



CREATE INDEX "idx_inventory_counts_unit" ON "mise"."inventory_counts" USING "btree" ("unit_id");



CREATE INDEX "idx_inventory_items_count" ON "mise"."inventory_count_items" USING "btree" ("count_id");



CREATE INDEX "idx_labels_employee" ON "mise"."labels" USING "btree" ("employee_id");



CREATE INDEX "idx_labels_status" ON "mise"."labels" USING "btree" ("status");



CREATE INDEX "idx_labels_unit" ON "mise"."labels" USING "btree" ("unit_id");



CREATE INDEX "idx_labels_validade" ON "mise"."labels" USING "btree" ("validade");



CREATE INDEX "idx_production_orders_date" ON "mise"."production_orders" USING "btree" ("created_at");



CREATE INDEX "idx_production_orders_item" ON "mise"."production_orders" USING "btree" ("menu_item_id");



CREATE INDEX "idx_production_orders_unit" ON "mise"."production_orders" USING "btree" ("unit_id");



CREATE INDEX "idx_receiving_items_ing" ON "mise"."receiving_items" USING "btree" ("ingredient_id");



CREATE INDEX "idx_receiving_items_rec" ON "mise"."receiving_items" USING "btree" ("receiving_id");



CREATE INDEX "idx_receiving_records_date" ON "mise"."receiving_records" USING "btree" ("received_at");



CREATE INDEX "idx_receiving_records_unit" ON "mise"."receiving_records" USING "btree" ("unit_id");



CREATE INDEX "idx_responsavel_unidades_responsavel_id" ON "mise"."responsavel_unidades" USING "btree" ("responsavel_id");



CREATE INDEX "idx_responsavel_unidades_unit_id" ON "mise"."responsavel_unidades" USING "btree" ("unit_id");



CREATE INDEX "idx_waste_date" ON "mise"."waste_records" USING "btree" ("created_at");



CREATE INDEX "idx_waste_unit" ON "mise"."waste_records" USING "btree" ("unit_id");



CREATE INDEX "event_entity_id_idx" ON "opx"."event" USING "btree" ("entity_id");



CREATE INDEX "event_module_type_idx" ON "opx"."event" USING "btree" ("module", "type");



CREATE INDEX "event_unit_id_occurred_at_idx" ON "opx"."event" USING "btree" ("unit_id", "occurred_at" DESC);



CREATE INDEX "access_requests_employee_idx" ON "public"."access_requests" USING "btree" ("employee_id");



CREATE INDEX "access_requests_status_idx" ON "public"."access_requests" USING "btree" ("status", "approver_tier");



CREATE INDEX "action_items_reuniao" ON "public"."reuniao_action_items" USING "btree" ("reuniao_id");



CREATE UNIQUE INDEX "agent_conversations_agent_phone" ON "public"."agent_conversations" USING "btree" ("agent", "phone");



CREATE INDEX "agent_metrics_agent_created" ON "public"."agent_metrics" USING "btree" ("agent", "created_at" DESC);



CREATE INDEX "agent_runs_agent_name_idx" ON "public"."agent_runs" USING "btree" ("agent_name");



CREATE INDEX "agent_runs_created_at_idx" ON "public"."agent_runs" USING "btree" ("created_at" DESC);



CREATE INDEX "agent_runs_week_idx" ON "public"."agent_runs" USING "btree" ("year", "week_number");



CREATE UNIQUE INDEX "candidates_phone_unique" ON "public"."candidates" USING "btree" ("phone");



CREATE INDEX "checklist_records_checklist_idx" ON "public"."checklist_records" USING "btree" ("checklist_id");



CREATE INDEX "checklist_records_unit_data_idx" ON "public"."checklist_records" USING "btree" ("unit_id", "data");



CREATE UNIQUE INDEX "contractors_responsavel_sem_cnpj" ON "public"."contractors" USING "btree" ("responsavel") WHERE ("cnpj" IS NULL);



CREATE INDEX "documents_employee_id_idx" ON "public"."documents" USING "btree" ("employee_id");



CREATE INDEX "employee_availability_unit_data_idx" ON "public"."employee_availability" USING "btree" ("unit_id", "data");



CREATE INDEX "employees_manager" ON "public"."employees" USING "btree" ("manager_id");



CREATE INDEX "feedbacks_para_employee" ON "public"."feedbacks" USING "btree" ("para_employee_id");



CREATE INDEX "feedbacks_unit" ON "public"."feedbacks" USING "btree" ("unit_id");



CREATE INDEX "gorjeta_distribuicao_employee_idx" ON "public"."gorjeta_distribuicao" USING "btree" ("employee_id");



CREATE INDEX "gorjeta_distribuicao_unit_period_idx" ON "public"."gorjeta_distribuicao" USING "btree" ("unit_id", "mes", "ano");



CREATE INDEX "hos_runs_active_idx" ON "public"."hos_runs" USING "btree" ("created_at" DESC) WHERE ("archived_at" IS NULL);



CREATE UNIQUE INDEX "hos_runs_deployment_id_job_idx" ON "public"."hos_runs" USING "btree" ("deployment_id", "job_id") WHERE ("deployment_id" IS NOT NULL);



CREATE INDEX "hos_runs_employee_id_idx" ON "public"."hos_runs" USING "btree" ("employee_id");



CREATE INDEX "idx_absences_employee" ON "public"."absences" USING "btree" ("employee_id", "data" DESC);



CREATE INDEX "idx_action_items_reuniao" ON "public"."reuniao_action_items" USING "btree" ("reuniao_id");



CREATE INDEX "idx_agendamentos_candidate_tipo" ON "public"."candidate_agendamentos" USING "btree" ("candidate_id", "tipo");



CREATE INDEX "idx_agendamentos_data_hora" ON "public"."candidate_agendamentos" USING "btree" ("data_hora");



CREATE INDEX "idx_agent_conversations_agent_status" ON "public"."agent_conversations" USING "btree" ("agent", "status", "last_activity" DESC);



CREATE INDEX "idx_agent_conversations_last_activity" ON "public"."agent_conversations" USING "btree" ("last_activity" DESC);



CREATE INDEX "idx_agent_prompt_versions_agent" ON "public"."agent_prompt_versions" USING "btree" ("agent");



CREATE INDEX "idx_agent_prompt_versions_ativo" ON "public"."agent_prompt_versions" USING "btree" ("agent", "ativo");



CREATE INDEX "idx_arquivos_contrato" ON "public"."contratos_arquivos" USING "btree" ("contrato_id");



CREATE INDEX "idx_audit_resource" ON "public"."audit_log" USING "btree" ("resource", "resource_id");



CREATE INDEX "idx_audit_user" ON "public"."audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_av_ciclos_unit" ON "public"."avaliacao_ciclos" USING "btree" ("unit_id");



CREATE INDEX "idx_av_part_avaliado" ON "public"."avaliacao_participantes" USING "btree" ("avaliado_id");



CREATE INDEX "idx_av_part_ciclo" ON "public"."avaliacao_participantes" USING "btree" ("ciclo_id");



CREATE INDEX "idx_brand_links_brand" ON "public"."brand_links" USING "btree" ("brand_id", "ordem");



CREATE INDEX "idx_brand_targets_brand" ON "public"."brand_targets" USING "btree" ("brand_id");



CREATE INDEX "idx_brand_targets_periodo" ON "public"."brand_targets" USING "btree" ("periodo");



CREATE INDEX "idx_brand_targets_unit" ON "public"."brand_targets" USING "btree" ("unit_id");



CREATE INDEX "idx_brands_group" ON "public"."brands" USING "btree" ("group_id");



CREATE INDEX "idx_campaigns_active" ON "public"."campaigns" USING "btree" ("active", "starts_at", "ends_at");



CREATE INDEX "idx_campaigns_brand" ON "public"."campaigns" USING "btree" ("brand_id");



CREATE INDEX "idx_cancel_det_wd" ON "public"."receita_cancelamentos_detalhe" USING "btree" ("workday_id_fk");



CREATE INDEX "idx_cand_agend_cand_tipo" ON "public"."candidate_agendamentos" USING "btree" ("candidate_id", "tipo");



CREATE INDEX "idx_cand_agend_data" ON "public"."candidate_agendamentos" USING "btree" ("data_hora");



CREATE INDEX "idx_candidates_access_code" ON "public"."candidates" USING "btree" ("access_code");



CREATE INDEX "idx_candidates_cidade" ON "public"."candidates" USING "btree" ("cidade") WHERE ("cidade" IS NOT NULL);



CREATE INDEX "idx_candidates_escolaridade" ON "public"."candidates" USING "btree" ("escolaridade_nivel") WHERE ("escolaridade_nivel" IS NOT NULL);



CREATE INDEX "idx_candidates_job_opening" ON "public"."candidates" USING "btree" ("job_opening_id");



CREATE INDEX "idx_candidates_opening" ON "public"."candidates" USING "btree" ("job_opening_id");



CREATE INDEX "idx_candidates_origem" ON "public"."candidates" USING "btree" ("origem");



CREATE INDEX "idx_candidates_pretensao" ON "public"."candidates" USING "btree" ("pretensao_salarial") WHERE ("pretensao_salarial" IS NOT NULL);



CREATE INDEX "idx_candidates_status" ON "public"."candidates" USING "btree" ("status");



CREATE INDEX "idx_candidates_unit" ON "public"."candidates" USING "btree" ("unit_id");



CREATE UNIQUE INDEX "idx_candidates_welcome_sid" ON "public"."candidates" USING "btree" ("welcome_message_sid") WHERE ("welcome_message_sid" IS NOT NULL);



CREATE INDEX "idx_candidatos_maya_status" ON "public"."candidatos_maya" USING "btree" ("status");



CREATE INDEX "idx_candidatos_maya_telefone" ON "public"."candidatos_maya" USING "btree" ("telefone");



CREATE INDEX "idx_client_interactions_cli" ON "public"."client_interactions" USING "btree" ("client_id", "data" DESC);



CREATE INDEX "idx_clients_ativo" ON "public"."clients" USING "btree" ("ativo");



CREATE INDEX "idx_clients_brand" ON "public"."clients" USING "btree" ("brand_id");



CREATE INDEX "idx_clients_created_at" ON "public"."clients" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_clients_origem" ON "public"."clients" USING "btree" ("origem");



CREATE INDEX "idx_clients_unit" ON "public"."clients" USING "btree" ("unit_id");



CREATE INDEX "idx_conferencias_unit_competencia" ON "public"."conferencias" USING "btree" ("unit_id", "competencia");



CREATE INDEX "idx_contatos_kph_candidate" ON "public"."contatos_kph" USING "btree" ("candidate_id");



CREATE INDEX "idx_contatos_kph_employee" ON "public"."contatos_kph" USING "btree" ("employee_id");



CREATE INDEX "idx_contatos_kph_telefone" ON "public"."contatos_kph" USING "btree" ("telefone");



CREATE INDEX "idx_contatos_kph_tipo" ON "public"."contatos_kph" USING "btree" ("tipo");



CREATE INDEX "idx_contratos_fim" ON "public"."contratos" USING "btree" ("data_fim");



CREATE INDEX "idx_contratos_unit" ON "public"."contratos" USING "btree" ("unit_id");



CREATE INDEX "idx_dependents_employee" ON "public"."dependents" USING "btree" ("employee_id");



CREATE INDEX "idx_descontos_det_wd" ON "public"."receita_descontos_detalhe" USING "btree" ("workday_id_fk");



CREATE INDEX "idx_documents_employee" ON "public"."documents" USING "btree" ("employee_id");



CREATE INDEX "idx_documents_type" ON "public"."documents" USING "btree" ("type");



CREATE INDEX "idx_dre_contratos_unit_id" ON "public"."dre_contratos_fixos" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_despesa_cls" ON "public"."dre_despesa_detalhada" USING "btree" ("classificacao_dre");



CREATE INDEX "idx_dre_despesa_det_unit_id" ON "public"."dre_despesa_detalhada" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_despesa_mes" ON "public"."dre_despesa_detalhada" USING "btree" ("mes_ano");



CREATE INDEX "idx_dre_despesa_tipo" ON "public"."dre_despesa_detalhada" USING "btree" ("tipo_despesa");



CREATE INDEX "idx_dre_folha_competencia" ON "public"."dre_folha" USING "btree" ("unit_id", "competencia");



CREATE INDEX "idx_dre_folha_documento" ON "public"."dre_folha" USING "btree" ("unit_id", "competencia", "documento_path");



CREATE INDEX "idx_dre_folha_unit_id" ON "public"."dre_folha" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_gorjeta_unit_id" ON "public"."dre_gorjeta_mensal" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_historico_unit_id" ON "public"."dre_faturamento_historico" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_indicadores_unit_id" ON "public"."dre_indicadores" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_kpis_unit_id" ON "public"."dre_kpis_mensais" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_linhas_det_unit_id" ON "public"."dre_linhas_detalhadas" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_manutencao_det_unit_id" ON "public"."dre_manutencao_detalhada" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_mensal_unit_id" ON "public"."dre_mensal" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_pessoal_det_unit_id" ON "public"."dre_pessoal_detalhado" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_prestadores_unit_id" ON "public"."dre_prestadores" USING "btree" ("unit_id");



CREATE INDEX "idx_dre_receita_det_unit_id" ON "public"."dre_receita_detalhada" USING "btree" ("unit_id");



CREATE INDEX "idx_ecd_folha" ON "public"."employee_codigos_dominio" USING "btree" ("cod_folha");



CREATE INDEX "idx_ecd_unit" ON "public"."employee_codigos_dominio" USING "btree" ("unit_id");



CREATE INDEX "idx_emp_docs_employee" ON "public"."employee_documents" USING "btree" ("employee_id");



CREATE INDEX "idx_emp_docs_tipo" ON "public"."employee_documents" USING "btree" ("tipo");



CREATE INDEX "idx_emp_docs_validade" ON "public"."employee_documents" USING "btree" ("data_validade") WHERE ("data_validade" IS NOT NULL);



CREATE INDEX "idx_employee_auth_cpf" ON "public"."employee_auth" USING "btree" ("cpf");



CREATE INDEX "idx_employee_auth_employee" ON "public"."employee_auth" USING "btree" ("employee_id");



CREATE INDEX "idx_employees_employee_code" ON "public"."employees" USING "btree" ("employee_code");



CREATE INDEX "idx_employees_score" ON "public"."employees" USING "btree" ("score" DESC);



CREATE INDEX "idx_employees_status_rh" ON "public"."employees" USING "btree" ("status_rh");



CREATE INDEX "idx_employees_unit" ON "public"."employees" USING "btree" ("unit_id");



CREATE INDEX "idx_event_attachments_event_id" ON "public"."event_attachments" USING "btree" ("event_id");



CREATE INDEX "idx_event_infra_items_event_id" ON "public"."event_infra_items" USING "btree" ("event_id");



CREATE INDEX "idx_event_menu_items_event_id" ON "public"."event_menu_items" USING "btree" ("event_id");



CREATE INDEX "idx_event_staff_event_id" ON "public"."event_staff" USING "btree" ("event_id");



CREATE INDEX "idx_event_status_log_event_id" ON "public"."event_status_log" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_events_brand_id" ON "public"."events" USING "btree" ("brand_id");



CREATE INDEX "idx_events_data_inicio" ON "public"."events" USING "btree" ("data_inicio" DESC);



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_events_unit_id" ON "public"."events" USING "btree" ("unit_id");



CREATE INDEX "idx_feedback_created" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_status" ON "public"."feedback" USING "btree" ("status");



CREATE INDEX "idx_feedback_user" ON "public"."feedback" USING "btree" ("user_id");



CREATE INDEX "idx_feedbacks_de" ON "public"."feedbacks" USING "btree" ("de_employee_id");



CREATE INDEX "idx_feedbacks_para" ON "public"."feedbacks" USING "btree" ("para_employee_id");



CREATE INDEX "idx_feedbacks_unit" ON "public"."feedbacks" USING "btree" ("unit_id");



CREATE INDEX "idx_fornecedores_depara_fornecedor_id" ON "public"."fornecedores_depara" USING "btree" ("fornecedor_id");



CREATE INDEX "idx_gorjeta_dias_employee" ON "public"."gorjeta_dias" USING "btree" ("employee_id");



CREATE INDEX "idx_gorjeta_dias_periodo" ON "public"."gorjeta_dias" USING "btree" ("periodo_id");



CREATE INDEX "idx_gorjeta_dias_unit_data" ON "public"."gorjeta_dias" USING "btree" ("unit_id", "data");



CREATE INDEX "idx_gorjeta_periodo_emp" ON "public"."gorjeta_distribuicao" USING "btree" ("unit_id", "periodo");



CREATE INDEX "idx_gorjeta_periodos_unit_data" ON "public"."gorjeta_periodos" USING "btree" ("unit_id", "data");



CREATE INDEX "idx_gorjeta_recibo_pendente" ON "public"."gorjeta_distribuicao" USING "btree" ("unit_id", "mes", "ano") WHERE ("recibo_gerado_at" IS NULL);



CREATE INDEX "idx_hos_insights_created_at" ON "public"."hos_insights" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hos_jobs_unit" ON "public"."hos_jobs" USING "btree" ("unit_id");



CREATE INDEX "idx_ingredient_stock_unit" ON "public"."ingredient_stock" USING "btree" ("unit_id", "ingredient_id");



CREATE INDEX "idx_ingredients_ativo" ON "public"."ingredients" USING "btree" ("ativo") WHERE ("ativo" = true);



CREATE INDEX "idx_ingredients_categoria" ON "public"."ingredients" USING "btree" ("categoria");



CREATE UNIQUE INDEX "idx_ingredients_codigo_group" ON "public"."ingredients" USING "btree" ("group_id", "codigo") WHERE ("codigo" IS NOT NULL);



CREATE INDEX "idx_ingredients_group" ON "public"."ingredients" USING "btree" ("group_id");



CREATE INDEX "idx_intelligence_score_semana" ON "public"."kph_intelligence_scores" USING "btree" ("semana" DESC);



CREATE INDEX "idx_interviews_candidate" ON "public"."interviews" USING "btree" ("candidate_id");



CREATE INDEX "idx_interviews_data" ON "public"."interviews" USING "btree" ("data_entrevista" DESC);



CREATE INDEX "idx_job_descriptions_brand_status" ON "public"."job_descriptions" USING "btree" ("brand_id", "status", "created_at" DESC);



CREATE INDEX "idx_job_opening_logs_opening" ON "public"."job_opening_logs" USING "btree" ("opening_id");



CREATE INDEX "idx_job_openings_ativas" ON "public"."job_openings" USING "btree" ("unit_id", "status") WHERE (("congelada" = false) AND ("cancelada" = false));



CREATE INDEX "idx_job_openings_cargo_grupo" ON "public"."job_openings" USING "btree" ("cargo_grupo_id");



CREATE INDEX "idx_job_requisitions_status" ON "public"."job_requisitions" USING "btree" ("status");



CREATE INDEX "idx_kis_modulo" ON "public"."kph_intelligence_scores" USING "btree" ("modulo");



CREATE INDEX "idx_klp_modulo_sev_pending" ON "public"."kph_learning_proposals" USING "btree" ("modulo", "severidade") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_kph_alerts_created" ON "public"."kph_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_kph_alerts_entidade_id" ON "public"."kph_alerts" USING "btree" ("entidade_id");



CREATE INDEX "idx_kph_alerts_prioridade" ON "public"."kph_alerts" USING "btree" ("prioridade");



CREATE INDEX "idx_kph_alerts_resolvido" ON "public"."kph_alerts" USING "btree" ("resolvido");



CREATE INDEX "idx_kph_insights_aprovado" ON "public"."kph_insights" USING "btree" ("aprovado");



CREATE INDEX "idx_kph_insights_modulo" ON "public"."kph_insights" USING "btree" ("modulo");



CREATE INDEX "idx_kph_insights_semana" ON "public"."kph_insights" USING "btree" ("semana" DESC);



CREATE INDEX "idx_kph_learning_proposals_created_at" ON "public"."kph_learning_proposals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_kph_learning_proposals_modulo_status" ON "public"."kph_learning_proposals" USING "btree" ("modulo", "status");



CREATE INDEX "idx_manutencao_mes" ON "public"."dre_manutencao_detalhada" USING "btree" ("mes_ano");



CREATE INDEX "idx_menu_items_ativo" ON "public"."menu_items" USING "btree" ("ativo") WHERE ("ativo" = true);



CREATE INDEX "idx_menu_items_brand" ON "public"."menu_items" USING "btree" ("brand_id");



CREATE INDEX "idx_menu_items_categoria" ON "public"."menu_items" USING "btree" ("categoria");



CREATE INDEX "idx_menu_items_unit" ON "public"."menu_items" USING "btree" ("unit_id") WHERE ("unit_id" IS NOT NULL);



CREATE INDEX "idx_mnt_aprov_chamado" ON "public"."manutencao_aprovacoes" USING "btree" ("chamado_id");



CREATE INDEX "idx_mnt_aprov_status" ON "public"."manutencao_aprovacoes" USING "btree" ("unit_id", "aprovado");



CREATE INDEX "idx_mnt_aprov_unit" ON "public"."manutencao_aprovacoes" USING "btree" ("unit_id", "data_solicitacao" DESC);



CREATE INDEX "idx_mnt_chamados_categoria" ON "public"."manutencao_chamados" USING "btree" ("unit_id", "categoria");



CREATE INDEX "idx_mnt_chamados_status" ON "public"."manutencao_chamados" USING "btree" ("unit_id", "status");



CREATE INDEX "idx_mnt_chamados_unit" ON "public"."manutencao_chamados" USING "btree" ("unit_id", "data_solicitacao" DESC);



CREATE INDEX "idx_mnt_parcelas_aprov" ON "public"."manutencao_parcelas" USING "btree" ("aprovacao_id", "numero");



CREATE INDEX "idx_mnt_parcelas_competencia" ON "public"."manutencao_parcelas" USING "btree" ("competencia", "pago");



CREATE INDEX "idx_movimentacoes_caixa_unit_data" ON "public"."movimentacoes_caixa" USING "btree" ("unit_id", "data");



CREATE INDEX "idx_movimentacoes_rh_data" ON "public"."movimentacoes_rh" USING "btree" ("data_movimentacao" DESC);



CREATE INDEX "idx_movimentacoes_rh_employee" ON "public"."movimentacoes_rh" USING "btree" ("employee_id");



CREATE INDEX "idx_movimentacoes_rh_tipo" ON "public"."movimentacoes_rh" USING "btree" ("tipo");



CREATE INDEX "idx_movimentacoes_rh_unidade" ON "public"."movimentacoes_rh" USING "btree" ("unidade_id");



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_lida" ON "public"."notifications" USING "btree" ("user_id", "lida", "created_at" DESC);



CREATE INDEX "idx_oa_auditor" ON "public"."orkestri_achados" USING "btree" ("auditor");



CREATE INDEX "idx_oa_created" ON "public"."orkestri_achados" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_oa_marca" ON "public"."orkestri_achados" USING "btree" ("marca");



CREATE INDEX "idx_oa_severidade" ON "public"."orkestri_achados" USING "btree" ("severidade");



CREATE INDEX "idx_oa_status" ON "public"."orkestri_achados" USING "btree" ("status");



CREATE INDEX "idx_oa_unit_status" ON "public"."orkestri_achados" USING "btree" ("unit_id", "status");



CREATE INDEX "idx_ob_checklist_run" ON "public"."onboarding_checklist" USING "btree" ("run_id");



CREATE INDEX "idx_ob_runs_employee" ON "public"."onboarding_runs" USING "btree" ("employee_id");



CREATE INDEX "idx_ob_runs_unit" ON "public"."onboarding_runs" USING "btree" ("unit_id");



CREATE INDEX "idx_ob_tarefas_template" ON "public"."onboarding_tarefas" USING "btree" ("template_id", "ordem");



CREATE INDEX "idx_ob_templates_unit" ON "public"."onboarding_templates" USING "btree" ("unit_id");



CREATE INDEX "idx_overtime_employee_periodo" ON "public"."overtime_records" USING "btree" ("employee_id", "periodo");



CREATE INDEX "idx_page_views_path" ON "public"."page_views" USING "btree" ("path");



CREATE INDEX "idx_page_views_user" ON "public"."page_views" USING "btree" ("user_id");



CREATE INDEX "idx_page_views_visited" ON "public"."page_views" USING "btree" ("visited_at" DESC);



CREATE INDEX "idx_par_employee_data" ON "public"."punch_adjustment_requests" USING "btree" ("employee_id", "data_referencia");



CREATE INDEX "idx_par_status" ON "public"."punch_adjustment_requests" USING "btree" ("status");



CREATE INDEX "idx_payslips_employee" ON "public"."payslips" USING "btree" ("employee_id", "competencia" DESC);



CREATE INDEX "idx_payslips_employee_code" ON "public"."payslips" USING "btree" ("employee_code");



CREATE INDEX "idx_pdi_metas_pdi" ON "public"."pdi_metas" USING "btree" ("pdi_id");



CREATE INDEX "idx_pdis_employee" ON "public"."pdis" USING "btree" ("employee_id");



CREATE INDEX "idx_pdis_unit" ON "public"."pdis" USING "btree" ("unit_id");



CREATE INDEX "idx_perf_reviews_employee" ON "public"."performance_reviews" USING "btree" ("employee_id");



CREATE INDEX "idx_perf_reviews_template" ON "public"."performance_reviews" USING "btree" ("template_id");



CREATE INDEX "idx_perf_templates_brand" ON "public"."performance_templates" USING "btree" ("brand_id");



CREATE INDEX "idx_performance_reviews_avaliador" ON "public"."performance_reviews" USING "btree" ("avaliador_id");



CREATE INDEX "idx_performance_reviews_data" ON "public"."performance_reviews" USING "btree" ("data_avaliacao" DESC);



CREATE INDEX "idx_performance_reviews_employee" ON "public"."performance_reviews" USING "btree" ("employee_id");



CREATE INDEX "idx_performance_reviews_periodo" ON "public"."performance_reviews" USING "btree" ("periodo");



CREATE INDEX "idx_performance_reviews_status" ON "public"."performance_reviews" USING "btree" ("status");



CREATE INDEX "idx_performance_reviews_template" ON "public"."performance_reviews" USING "btree" ("template_id");



CREATE INDEX "idx_performance_templates_ativo" ON "public"."performance_templates" USING "btree" ("ativo");



CREATE INDEX "idx_performance_templates_brand" ON "public"."performance_templates" USING "btree" ("brand_id");



CREATE INDEX "idx_performance_templates_funcao" ON "public"."performance_templates" USING "btree" ("funcao");



CREATE INDEX "idx_performance_templates_unit" ON "public"."performance_templates" USING "btree" ("unit_id");



CREATE INDEX "idx_pfl_employee" ON "public"."payroll_fechamento_linha" USING "btree" ("employee_id");



CREATE INDEX "idx_pfl_periodo" ON "public"."payroll_fechamento_linha" USING "btree" ("periodo_id");



CREATE INDEX "idx_pfp_unit_comp" ON "public"."payroll_fechamento_periodo" USING "btree" ("unit_id", "competencia");



CREATE INDEX "idx_pipeline_autor_id" ON "public"."candidate_pipeline" USING "btree" ("autor_id");



CREATE INDEX "idx_pipeline_candidate" ON "public"."candidate_pipeline" USING "btree" ("candidate_id");



CREATE INDEX "idx_pipeline_created_at" ON "public"."candidate_pipeline" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_pipeline_etapa" ON "public"."candidate_pipeline" USING "btree" ("etapa");



CREATE INDEX "idx_pipeline_para_status" ON "public"."candidate_pipeline" USING "btree" ("para_status");



CREATE INDEX "idx_pr_categoria" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "desc_gerencial");



CREATE INDEX "idx_pr_unit_mes" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "ano_lancamento", "mes_lancamento");



CREATE INDEX "idx_prestadores_mes" ON "public"."dre_prestadores" USING "btree" ("mes_ano");



CREATE INDEX "idx_price_history_ingredient" ON "public"."ingredient_price_history" USING "btree" ("ingredient_id", "created_at" DESC);



CREATE INDEX "idx_produtos_depara_produto_id" ON "public"."produtos_depara" USING "btree" ("produto_id");



CREATE INDEX "idx_produtos_dia_wd" ON "public"."receita_produtos_dia" USING "btree" ("workday_id_fk");



CREATE INDEX "idx_produtos_relatorio_produto_id" ON "public"."produtos_relatorio" USING "btree" ("produto_id");



CREATE INDEX "idx_produtos_relatorio_unit_direcao_periodo" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "direcao_nfe", "ano_lancamento", "mes_lancamento");



CREATE INDEX "idx_produtos_relatorio_unit_mes" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "ano_lancamento", "mes_lancamento");



CREATE INDEX "idx_protestos_certidoes_unit" ON "public"."protestos_certidoes" USING "btree" ("unit_id");



CREATE INDEX "idx_protestos_registros_certidao" ON "public"."protestos_registros" USING "btree" ("certidao_id");



CREATE INDEX "idx_protestos_registros_situacao" ON "public"."protestos_registros" USING "btree" ("situacao");



CREATE INDEX "idx_punches_employee" ON "public"."time_clock_punches" USING "btree" ("employee_id", "timestamp_punch" DESC);



CREATE INDEX "idx_purchase_invoice_items_codigo" ON "public"."purchase_invoice_items" USING "btree" ("ingredient_codigo");



CREATE INDEX "idx_purchase_invoice_items_ingredient" ON "public"."purchase_invoice_items" USING "btree" ("ingredient_id") WHERE ("ingredient_id" IS NOT NULL);



CREATE INDEX "idx_purchase_invoice_items_invoice" ON "public"."purchase_invoice_items" USING "btree" ("purchase_invoice_id");



CREATE INDEX "idx_purchase_invoices_data_emissao" ON "public"."purchase_invoices" USING "btree" ("data_emissao" DESC);



CREATE INDEX "idx_purchase_invoices_mes_referencia" ON "public"."purchase_invoices" USING "btree" ("mes_referencia");



CREATE INDEX "idx_purchase_invoices_unit" ON "public"."purchase_invoices" USING "btree" ("unit_id");



CREATE INDEX "idx_purchase_order_items_order" ON "public"."purchase_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_purchase_orders_brand" ON "public"."purchase_orders" USING "btree" ("brand_id");



CREATE INDEX "idx_purchase_orders_data_pedido" ON "public"."purchase_orders" USING "btree" ("data_pedido" DESC);



CREATE INDEX "idx_purchase_orders_status" ON "public"."purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_purchase_orders_unit" ON "public"."purchase_orders" USING "btree" ("unit_id");



CREATE INDEX "idx_quadro_ideal_unit_vigente" ON "public"."quadro_ideal" USING "btree" ("unit_id") WHERE ("vigente_ate" IS NULL);



CREATE UNIQUE INDEX "idx_quadro_unit_cargo_ativo" ON "public"."quadro_ideal" USING "btree" ("unit_id", "cargo_id") WHERE (("vigente_ate" IS NULL) AND ("cargo_id" IS NOT NULL));



CREATE INDEX "idx_questions_job_order" ON "public"."interview_questions" USING "btree" ("job_opening_id", "order_num");



CREATE INDEX "idx_recebimento_itens_recebimento" ON "public"."recebimento_itens" USING "btree" ("recebimento_id");



CREATE INDEX "idx_recebimentos_pedido" ON "public"."recebimentos" USING "btree" ("pedido_id");



CREATE INDEX "idx_recebimentos_status" ON "public"."recebimentos" USING "btree" ("pedido_id", "status");



CREATE INDEX "idx_recebimentos_unit" ON "public"."recebimentos" USING "btree" ("unit_id", "created_at" DESC);



CREATE INDEX "idx_recebiveis_cartao_unit_data" ON "public"."recebiveis_cartao" USING "btree" ("unit_id", "data_venda");



CREATE INDEX "idx_recipe_items_ingredient" ON "public"."recipe_items" USING "btree" ("ingredient_id") WHERE ("ingredient_id" IS NOT NULL);



CREATE INDEX "idx_recipe_items_menu" ON "public"."recipe_items" USING "btree" ("menu_item_id");



CREATE INDEX "idx_recipe_notes_menu" ON "public"."recipe_notes" USING "btree" ("menu_item_id", "created_at" DESC);



CREATE INDEX "idx_responses_candidate" ON "public"."interview_responses" USING "btree" ("candidate_id");



CREATE INDEX "idx_reunioes_colaborador" ON "public"."reunioes_1on1" USING "btree" ("colaborador_id");



CREATE INDEX "idx_reunioes_data" ON "public"."reunioes_1on1" USING "btree" ("data_reuniao" DESC);



CREATE INDEX "idx_reunioes_gestor" ON "public"."reunioes_1on1" USING "btree" ("gestor_id");



CREATE INDEX "idx_roadmap_sprint" ON "public"."roadmap_items" USING "btree" ("sprint");



CREATE INDEX "idx_roadmap_status" ON "public"."roadmap_items" USING "btree" ("status");



CREATE INDEX "idx_score_events_employee" ON "public"."score_events" USING "btree" ("employee_id", "created_at" DESC);



CREATE INDEX "idx_shifts_employee_data" ON "public"."shifts" USING "btree" ("employee_id", "data");



CREATE INDEX "idx_shifts_unit_data" ON "public"."shifts" USING "btree" ("unit_id", "data");



CREATE INDEX "idx_suppliers_ativo" ON "public"."suppliers" USING "btree" ("ativo");



CREATE INDEX "idx_suppliers_brand" ON "public"."suppliers" USING "btree" ("brand_id");



CREATE INDEX "idx_suppliers_unit" ON "public"."suppliers" USING "btree" ("unit_id");



CREATE INDEX "idx_target_notes_target" ON "public"."target_notes" USING "btree" ("target_id", "created_at" DESC);



CREATE INDEX "idx_theo_tickets_employee" ON "public"."theo_tickets" USING "btree" ("employee_id");



CREATE INDEX "idx_theo_tickets_status" ON "public"."theo_tickets" USING "btree" ("status");



CREATE INDEX "idx_time_records_employee_periodo" ON "public"."time_records" USING "btree" ("employee_id", "periodo");



CREATE INDEX "idx_titulo_override_titulo" ON "public"."titulo_override" USING "btree" ("titulo_id");



CREATE INDEX "idx_titulos_unit_vencimento" ON "public"."titulos_a_pagar" USING "btree" ("unit_id", "d_vencimento");



CREATE INDEX "idx_training_records_emp" ON "public"."training_records" USING "btree" ("employee_id");



CREATE INDEX "idx_training_records_employee" ON "public"."training_records" USING "btree" ("employee_id");



CREATE INDEX "idx_training_records_status" ON "public"."training_records" USING "btree" ("status");



CREATE INDEX "idx_training_records_template" ON "public"."training_records" USING "btree" ("template_id");



CREATE INDEX "idx_training_records_tmpl" ON "public"."training_records" USING "btree" ("template_id");



CREATE INDEX "idx_training_records_validade" ON "public"."training_records" USING "btree" ("validade_ate");



CREATE INDEX "idx_training_templates_brand" ON "public"."training_templates" USING "btree" ("brand_id");



CREATE INDEX "idx_training_templates_funcao" ON "public"."training_templates" USING "btree" ("funcao");



CREATE INDEX "idx_training_templates_unit" ON "public"."training_templates" USING "btree" ("unit_id");



CREATE INDEX "idx_training_tmpl_brand" ON "public"."training_templates" USING "btree" ("brand_id");



CREATE INDEX "idx_units_brand" ON "public"."units" USING "btree" ("brand_id");



CREATE INDEX "idx_user_roles_brand" ON "public"."user_roles" USING "btree" ("brand_id");



CREATE INDEX "idx_user_roles_unit" ON "public"."user_roles" USING "btree" ("unit_id");



CREATE INDEX "idx_user_roles_user" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_vacations_employee" ON "public"."vacations" USING "btree" ("employee_id");



CREATE INDEX "idx_vacations_status" ON "public"."vacations" USING "btree" ("status");



CREATE INDEX "idx_vcamb_periodo" ON "public"."vendas_consolidado_ambiente" USING "btree" ("periodo_id");



CREATE INDEX "idx_vcdia_periodo" ON "public"."vendas_consolidado_dia_semana" USING "btree" ("periodo_id", "ordem");



CREATE INDEX "idx_vcfunc_periodo" ON "public"."vendas_consolidado_funcionarios" USING "btree" ("periodo_id", "bruto" DESC);



CREATE INDEX "idx_vcmensal_periodo" ON "public"."vendas_consolidado_mensal" USING "btree" ("periodo_id", "ordem");



CREATE INDEX "idx_vcp_unit" ON "public"."vendas_consolidado_periodo" USING "btree" ("unit_id", "data_inicio" DESC);



CREATE INDEX "idx_vcprod_periodo" ON "public"."vendas_consolidado_produtos" USING "btree" ("periodo_id", "valor_liquido" DESC);



CREATE UNIQUE INDEX "idx_vcr_periodo" ON "public"."vendas_consolidado_resumo" USING "btree" ("periodo_id");



CREATE INDEX "idx_vcturno_periodo" ON "public"."vendas_consolidado_turno" USING "btree" ("periodo_id");



CREATE INDEX "idx_vt_employee_periodo" ON "public"."transport_vouchers" USING "btree" ("employee_id", "periodo");



CREATE INDEX "idx_warnings_employee" ON "public"."warnings" USING "btree" ("employee_id", "data" DESC);



CREATE UNIQUE INDEX "ingredients_group_codigo_uniq" ON "public"."ingredients" USING "btree" ("group_id", "codigo") WHERE ("codigo" IS NOT NULL);



CREATE INDEX "ix_dom_cad_cpf" ON "public"."payroll_dominio_cadastro" USING "btree" ("cpf");



CREATE INDEX "ix_dom_cad_emp" ON "public"."payroll_dominio_cadastro" USING "btree" ("employee_id");



CREATE INDEX "ix_dom_cad_norm" ON "public"."payroll_dominio_cadastro" USING "btree" ("nome_norm");



CREATE INDEX "ix_extrato_colab_comp" ON "public"."payroll_extrato_dominio_colaborador" USING "btree" ("competencia");



CREATE INDEX "ix_extrato_colab_cpf" ON "public"."payroll_extrato_dominio_colaborador" USING "btree" ("cpf");



CREATE INDEX "ix_extrato_colab_emp" ON "public"."payroll_extrato_dominio_colaborador" USING "btree" ("employee_id");



CREATE INDEX "ix_extrato_linha_comp" ON "public"."payroll_extrato_dominio_linha" USING "btree" ("competencia", "rubrica_codigo");



CREATE INDEX "ix_extrato_linha_emp" ON "public"."payroll_extrato_dominio_linha" USING "btree" ("employee_id");



CREATE INDEX "job_descriptions_brand_id_idx" ON "public"."job_descriptions" USING "btree" ("brand_id");



CREATE INDEX "job_descriptions_cargo_idx" ON "public"."job_descriptions" USING "btree" ("cargo");



CREATE INDEX "lancamentos_conta_codigo_idx" ON "public"."lancamentos" USING "btree" ("conta_codigo");



CREATE INDEX "lancamentos_origem_idx" ON "public"."lancamentos" USING "btree" ("origem", "origem_id");



CREATE UNIQUE INDEX "lancamentos_source_scope" ON "public"."lancamentos" USING "btree" ("unit_id", "competencia", "origem", "origem_id", "conta_codigo");



CREATE INDEX "lancamentos_unit_competencia_idx" ON "public"."lancamentos" USING "btree" ("unit_id", "competencia");



CREATE INDEX "lm_reports_week_idx" ON "public"."learning_machine_reports" USING "btree" ("year" DESC, "week_number" DESC);



CREATE UNIQUE INDEX "menu_items_unit_codigo_uniq" ON "public"."menu_items" USING "btree" ("unit_id", "codigo") WHERE ("codigo" IS NOT NULL);



CREATE INDEX "orquestrador_jobs_created_at_idx" ON "public"."orquestrador_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "orquestrador_jobs_type_idx" ON "public"."orquestrador_jobs" USING "btree" ("type");



CREATE INDEX "payroll_extrato_dominio_competencia_cnpj_idx" ON "public"."payroll_extrato_dominio_competencia" USING "btree" ("cnpj");



CREATE INDEX "pdi_metas_pdi" ON "public"."pdi_metas" USING "btree" ("pdi_id");



CREATE INDEX "pdis_employee" ON "public"."pdis" USING "btree" ("employee_id");



CREATE INDEX "price_quote_items_quote_idx" ON "public"."price_quote_items" USING "btree" ("quote_id");



CREATE INDEX "price_quotes_unit_idx" ON "public"."price_quotes" USING "btree" ("unit_id", "periodo");



CREATE UNIQUE INDEX "produtos_relatorio_identity" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "nr_danfe", "item_codigo", "fornecedor_codigo", "chave_nfe", "item_nfe") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "produtos_relatorio_nfe_position" ON "public"."produtos_relatorio" USING "btree" ("unit_id", "chave_nfe", "item_nfe") WHERE ("chave_nfe" IS NOT NULL);



CREATE INDEX "quality_checklists_unit_idx" ON "public"."quality_checklists" USING "btree" ("unit_id");



CREATE INDEX "receita_cancelamentos_workday" ON "public"."receita_cancelamentos" USING "btree" ("workday_id_fk");



CREATE INDEX "receita_horarios_workday" ON "public"."receita_horarios" USING "btree" ("workday_id_fk");



CREATE INDEX "receita_usuarios_workday" ON "public"."receita_usuarios" USING "btree" ("workday_id_fk");



CREATE INDEX "recipe_items_menu_item_idx" ON "public"."recipe_items" USING "btree" ("menu_item_id");



CREATE INDEX "relatorio_produtos_calcula_cmv_idx" ON "public"."relatorio_produtos" USING "btree" ("calcula_cmv");



CREATE INDEX "relatorio_produtos_desc_gerencial_idx" ON "public"."relatorio_produtos" USING "btree" ("desc_gerencial");



CREATE INDEX "relatorio_produtos_mes_lancamento_ano_lancamento_idx" ON "public"."relatorio_produtos" USING "btree" ("mes_lancamento", "ano_lancamento");



CREATE INDEX "relatorio_produtos_unit_id_idx" ON "public"."relatorio_produtos" USING "btree" ("unit_id");



CREATE INDEX "reservations_unit_data_idx" ON "public"."reservations" USING "btree" ("unit_id", "data");



CREATE INDEX "reunioes_colaborador" ON "public"."reunioes_1on1" USING "btree" ("colaborador_id");



CREATE INDEX "reunioes_data" ON "public"."reunioes_1on1" USING "btree" ("data_reuniao");



CREATE INDEX "reunioes_gestor" ON "public"."reunioes_1on1" USING "btree" ("gestor_id");



CREATE INDEX "titulo_pagamentos_titulo" ON "public"."titulo_pagamentos" USING "btree" ("titulo_id");



CREATE INDEX "titulos_import_scope" ON "public"."titulos_a_pagar" USING "btree" ("import_unit_id", "d_competencia", "origem");



CREATE INDEX "unit_cnpjs_unit_id_idx" ON "public"."unit_cnpjs" USING "btree" ("unit_id");



CREATE UNIQUE INDEX "units_cnpj_key" ON "public"."units" USING "btree" ("cnpj") WHERE ("cnpj" IS NOT NULL);



CREATE UNIQUE INDEX "uq_cargo_salario" ON "public"."cargo_salarios" USING "btree" ("cargo_id", COALESCE("nivel", 0), COALESCE("unit_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE UNIQUE INDEX "uq_protestos_certidoes_devedor_data" ON "public"."protestos_certidoes" USING "btree" ("cnpj_devedor", "data_certidao") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "uq_protestos_registros_certidao_numero" ON "public"."protestos_registros" USING "btree" ("certidao_id", "numero_registro");



CREATE UNIQUE INDEX "uq_titulos_chave" ON "public"."titulos_a_pagar" USING "btree" ("n_titulo", "parcela", "fantasia_empresa", "ref_mes") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "user_roles_scope_key" ON "public"."user_roles" USING "btree" ("user_id", "role_id", COALESCE("unit_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("brand_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("group_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE OR REPLACE VIEW "public"."v_vagas_pipeline" WITH ("security_invoker"='true') AS
 SELECT "jo"."id",
    "jo"."brand_id",
    "jo"."unit_id",
    "jo"."title",
    "jo"."description",
    "jo"."is_active",
    "jo"."created_by",
    "jo"."created_at",
    "jo"."status",
    "jo"."recrutador",
    "jo"."sla_dias",
    "jo"."status_prazo",
    "jo"."motivo",
    "jo"."horario",
    "jo"."salario",
    "jo"."fonte_recrutamento",
    "jo"."data_admissao",
    "jo"."candidato_aprovado",
    "jo"."fechamento_previsto",
    "jo"."observacoes",
    (CURRENT_DATE - ("jo"."created_at")::"date") AS "dias_corridos",
    "u"."name" AS "unit_name",
    "b"."name" AS "brand_name",
    "count"("jol"."id") AS "total_logs",
    "max"("jol"."created_at") AS "ultimo_log_em"
   FROM ((("public"."job_openings" "jo"
     LEFT JOIN "public"."units" "u" ON (("u"."id" = "jo"."unit_id")))
     LEFT JOIN "public"."brands" "b" ON (("b"."id" = "u"."brand_id")))
     LEFT JOIN "public"."job_opening_logs" "jol" ON (("jol"."opening_id" = "jo"."id")))
  GROUP BY "jo"."id", "u"."name", "b"."name";



CREATE OR REPLACE TRIGGER "event_no_delete" BEFORE DELETE ON "opx"."event" FOR EACH ROW EXECUTE FUNCTION "opx"."block_mutation"();



CREATE OR REPLACE TRIGGER "event_no_update" BEFORE UPDATE ON "opx"."event" FOR EACH ROW EXECUTE FUNCTION "opx"."block_mutation"();



CREATE OR REPLACE TRIGGER "evidence_no_delete" BEFORE DELETE ON "opx"."evidence" FOR EACH ROW EXECUTE FUNCTION "opx"."block_mutation"();



CREATE OR REPLACE TRIGGER "evidence_no_update" BEFORE UPDATE ON "opx"."evidence" FOR EACH ROW EXECUTE FUNCTION "opx"."block_mutation"();



CREATE OR REPLACE TRIGGER "candidates_updated_at" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."fornecedores" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."fornecedores_depara" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."lancamentos" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."payroll_extrato_dominio_competencia" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."payroll_extrato_dominio_linha" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."plano_contas" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."produtos_catalogo" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."produtos_depara" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."produtos_relatorio" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."receita_cancelamentos" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."receita_dias" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."regras_classificacao" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "financeiro_revision" AFTER INSERT OR DELETE OR UPDATE ON "public"."titulos_a_pagar" FOR EACH ROW EXECUTE FUNCTION "public"."financeiro_source_changed"();



CREATE OR REPLACE TRIGGER "pdis_updated_at" BEFORE UPDATE ON "public"."pdis" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "runs_updated_at" BEFORE UPDATE ON "public"."hos_runs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_brand_targets_updated_at" BEFORE UPDATE ON "public"."brand_targets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."events_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gorjeta_cargo_pontos_updated_at" BEFORE UPDATE ON "public"."gorjeta_cargo_pontos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_gorjeta_periodos_updated_at" BEFORE UPDATE ON "public"."gorjeta_periodos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ingredient_price_change" AFTER UPDATE ON "public"."ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ingredient_price_change"();



CREATE OR REPLACE TRIGGER "trg_job_openings_status_prazo" BEFORE INSERT OR UPDATE ON "public"."job_openings" FOR EACH ROW EXECUTE FUNCTION "public"."fn_recalc_status_prazo"();



CREATE OR REPLACE TRIGGER "trg_mnt_aprov_updated" BEFORE UPDATE ON "public"."manutencao_aprovacoes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_mnt_chamados_updated" BEFORE UPDATE ON "public"."manutencao_chamados" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_oa_atualizado" BEFORE UPDATE ON "public"."orkestri_achados" FOR EACH ROW EXECUTE FUNCTION "public"."fn_oa_set_atualizado_em"();



CREATE OR REPLACE TRIGGER "trg_performance_reviews_updated_at" BEFORE UPDATE ON "public"."performance_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_performance_templates_updated_at" BEFORE UPDATE ON "public"."performance_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_purchase_orders_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_recalc_po_total_iud" AFTER INSERT OR DELETE OR UPDATE ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."recalc_purchase_order_total"();



CREATE OR REPLACE TRIGGER "trg_recipe_items_recalc" AFTER INSERT OR DELETE OR UPDATE ON "public"."recipe_items" FOR EACH ROW EXECUTE FUNCTION "public"."fn_recalc_menu_item_custo"();



CREATE OR REPLACE TRIGGER "trg_sync_employee_tier" BEFORE INSERT OR UPDATE OF "role_id" ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."_sync_employee_tier"();



CREATE OR REPLACE TRIGGER "trg_sync_qtd_alvo" BEFORE INSERT OR UPDATE ON "public"."quadro_ideal" FOR EACH ROW EXECUTE FUNCTION "public"."fn_sync_qtd_alvo"();



CREATE OR REPLACE TRIGGER "trg_training_records_updated_at" BEFORE UPDATE ON "public"."training_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_training_templates_updated_at" BEFORE UPDATE ON "public"."training_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "mise"."checklist_action_plans"
    ADD CONSTRAINT "checklist_action_plans_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "mise"."sessions"("id");



ALTER TABLE ONLY "mise"."checklist_action_plans"
    ADD CONSTRAINT "checklist_action_plans_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "mise"."checklist_responses"("id");



ALTER TABLE ONLY "mise"."checklist_executions"
    ADD CONSTRAINT "checklist_execucoes_iniciado_por_fkey" FOREIGN KEY ("iniciado_por") REFERENCES "mise"."sessions"("id");



ALTER TABLE ONLY "mise"."checklist_executions"
    ADD CONSTRAINT "checklist_execucoes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mise"."checklist_templates"("id");



ALTER TABLE ONLY "mise"."checklist_executions"
    ADD CONSTRAINT "checklist_execucoes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."checklist_execution_topicos"
    ADD CONSTRAINT "checklist_execution_topicos_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "mise"."checklist_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."checklist_executions"
    ADD CONSTRAINT "checklist_executions_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "mise"."crivo_locais"("id");



ALTER TABLE ONLY "mise"."checklist_responses"
    ADD CONSTRAINT "checklist_responses_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "mise"."checklist_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."checklist_responses"
    ADD CONSTRAINT "checklist_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "mise"."checklist_template_items"("id");



ALTER TABLE ONLY "mise"."checklist_template_items"
    ADD CONSTRAINT "checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mise"."checklist_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."crivo_locais"
    ADD CONSTRAINT "crivo_locais_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."ingredient_shelf_life"
    ADD CONSTRAINT "ingredient_shelf_life_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."inventory_count_items"
    ADD CONSTRAINT "inventory_count_items_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "mise"."inventory_counts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."inventory_count_items"
    ADD CONSTRAINT "inventory_count_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "mise"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "mise"."inventory_counts"
    ADD CONSTRAINT "inventory_counts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_print_point_id_fkey" FOREIGN KEY ("print_point_id") REFERENCES "mise"."print_points"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "mise"."production_orders"("id");



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "mise"."responsaveis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "mise"."labels"
    ADD CONSTRAINT "labels_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."print_points"
    ADD CONSTRAINT "print_points_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."production_orders"
    ADD CONSTRAINT "production_orders_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "mise"."production_orders"
    ADD CONSTRAINT "production_orders_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "mise"."production_orders"
    ADD CONSTRAINT "production_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."receiving_items"
    ADD CONSTRAINT "receiving_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "mise"."receiving_items"
    ADD CONSTRAINT "receiving_items_receiving_id_fkey" FOREIGN KEY ("receiving_id") REFERENCES "mise"."receiving_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."receiving_records"
    ADD CONSTRAINT "receiving_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "mise"."receiving_records"
    ADD CONSTRAINT "receiving_records_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "mise"."receiving_records"
    ADD CONSTRAINT "receiving_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."responsavel_unidades"
    ADD CONSTRAINT "responsavel_unidades_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "mise"."responsaveis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."responsavel_unidades"
    ADD CONSTRAINT "responsavel_unidades_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "mise"."sessions"
    ADD CONSTRAINT "sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."user_pins"
    ADD CONSTRAINT "user_pins_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "mise"."waste_records"
    ADD CONSTRAINT "waste_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "mise"."waste_records"
    ADD CONSTRAINT "waste_records_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id");



ALTER TABLE ONLY "mise"."waste_records"
    ADD CONSTRAINT "waste_records_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "mise"."labels"("id");



ALTER TABLE ONLY "mise"."waste_records"
    ADD CONSTRAINT "waste_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "opx"."event"
    ADD CONSTRAINT "event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "opx"."event"
    ADD CONSTRAINT "event_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "opx"."evidence"
    ADD CONSTRAINT "evidence_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "opx"."event"("id");



ALTER TABLE ONLY "public"."Comments"
    ADD CONSTRAINT "Comments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."Team_Members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Comments"
    ADD CONSTRAINT "Comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."Tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Task_Assignees"
    ADD CONSTRAINT "Task_Assignees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."Team_Members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Task_Assignees"
    ADD CONSTRAINT "Task_Assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."Tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Tasks"
    ADD CONSTRAINT "Tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."Projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."absences"
    ADD CONSTRAINT "absences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_plan_tasks"
    ADD CONSTRAINT "action_plan_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."action_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."agent_prompt_versions"
    ADD CONSTRAINT "agent_prompt_versions_ativado_por_fkey" FOREIGN KEY ("ativado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attendance_summaries"
    ADD CONSTRAINT "attendance_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."attendance_summaries"
    ADD CONSTRAINT "attendance_summaries_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."avaliacao_ciclos"
    ADD CONSTRAINT "avaliacao_ciclos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."avaliacao_ciclos"
    ADD CONSTRAINT "avaliacao_ciclos_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."performance_templates"("id");



ALTER TABLE ONLY "public"."avaliacao_ciclos"
    ADD CONSTRAINT "avaliacao_ciclos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_participantes_avaliado_id_fkey" FOREIGN KEY ("avaliado_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_participantes_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_participantes_ciclo_id_fkey" FOREIGN KEY ("ciclo_id") REFERENCES "public"."avaliacao_ciclos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."avaliacao_participantes"
    ADD CONSTRAINT "avaliacao_participantes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."performance_reviews"("id");



ALTER TABLE ONLY "public"."brand_links"
    ADD CONSTRAINT "brand_links_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."brand_targets"
    ADD CONSTRAINT "brand_targets_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."brand_targets"
    ADD CONSTRAINT "brand_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."brand_targets"
    ADD CONSTRAINT "brand_targets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."brands"
    ADD CONSTRAINT "brands_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buckets"
    ADD CONSTRAINT "buckets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."candidate_agendamentos"
    ADD CONSTRAINT "candidate_agendamentos_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_agendamentos"
    ADD CONSTRAINT "candidate_agendamentos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."candidate_avaliacao"
    ADD CONSTRAINT "candidate_avaliacao_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_feedback_operacional"
    ADD CONSTRAINT "candidate_feedback_operacional_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "public"."candidate_agendamentos"("id");



ALTER TABLE ONLY "public"."candidate_feedback_operacional"
    ADD CONSTRAINT "candidate_feedback_operacional_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_pipeline"
    ADD CONSTRAINT "candidate_pipeline_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidate_pipeline"
    ADD CONSTRAINT "candidate_pipeline_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_pipeline"
    ADD CONSTRAINT "candidate_pipeline_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_entrevistador_id_fkey" FOREIGN KEY ("entrevistador_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "public"."job_openings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_origem_id_fkey" FOREIGN KEY ("origem_id") REFERENCES "public"."origens_candidato"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cargo_salarios"
    ADD CONSTRAINT "cargo_salarios_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cargo_salarios"
    ADD CONSTRAINT "cargo_salarios_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cargos"
    ADD CONSTRAINT "cargos_reporta_a_cargo_id_fkey" FOREIGN KEY ("reporta_a_cargo_id") REFERENCES "public"."cargos"("id");



ALTER TABLE ONLY "public"."checklist_records"
    ADD CONSTRAINT "checklist_records_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "public"."quality_checklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_records"
    ADD CONSTRAINT "checklist_records_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."checklist_records"
    ADD CONSTRAINT "checklist_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_interactions"
    ADD CONSTRAINT "client_interactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_interactions"
    ADD CONSTRAINT "client_interactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."climate_questions"
    ADD CONSTRAINT "climate_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."climate_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."climate_responses"
    ADD CONSTRAINT "climate_responses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."climate_responses"
    ADD CONSTRAINT "climate_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."climate_questions"("id");



ALTER TABLE ONLY "public"."climate_responses"
    ADD CONSTRAINT "climate_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."climate_surveys"("id");



ALTER TABLE ONLY "public"."climate_survey_questions"
    ADD CONSTRAINT "climate_survey_questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."climate_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."climate_survey_questions"("id");



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."climate_surveys"("id");



ALTER TABLE ONLY "public"."climate_surveys"
    ADD CONSTRAINT "climate_surveys_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conferencias"
    ADD CONSTRAINT "conferencias_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."contas_bancarias"
    ADD CONSTRAINT "contas_bancarias_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."contatos_kph"
    ADD CONSTRAINT "contatos_kph_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id");



ALTER TABLE ONLY "public"."contatos_kph"
    ADD CONSTRAINT "contatos_kph_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."contractor_payments"
    ADD CONSTRAINT "contractor_payments_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id");



ALTER TABLE ONLY "public"."contractor_payments"
    ADD CONSTRAINT "contractor_payments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."contractor_vacations"
    ADD CONSTRAINT "contractor_vacations_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id");



ALTER TABLE ONLY "public"."contractor_vacations"
    ADD CONSTRAINT "contractor_vacations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."contractors"
    ADD CONSTRAINT "contractors_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."contratos_arquivos"
    ADD CONSTRAINT "contratos_arquivos_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dependents"
    ADD CONSTRAINT "dependents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dho_tracking"
    ADD CONSTRAINT "dho_tracking_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."dho_tracking"
    ADD CONSTRAINT "dho_tracking_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."disc_profiles"
    ADD CONSTRAINT "disc_profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."disciplinary_actions"
    ADD CONSTRAINT "disciplinary_actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."disciplinary_actions"
    ADD CONSTRAINT "disciplinary_actions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."dre_snapshot"
    ADD CONSTRAINT "dre_snapshot_conta_codigo_fkey" FOREIGN KEY ("conta_codigo") REFERENCES "public"."plano_contas"("codigo");



ALTER TABLE ONLY "public"."employee_auth"
    ADD CONSTRAINT "employee_auth_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_availability"
    ADD CONSTRAINT "employee_availability_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."employee_codigos_dominio"
    ADD CONSTRAINT "employee_codigos_dominio_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_codigos_dominio"
    ADD CONSTRAINT "employee_codigos_dominio_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_attachments"
    ADD CONSTRAINT "event_attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_attachments"
    ADD CONSTRAINT "event_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_infra_items"
    ADD CONSTRAINT "event_infra_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_menu_items"
    ADD CONSTRAINT "event_menu_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_staff"
    ADD CONSTRAINT "event_staff_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."event_staff"
    ADD CONSTRAINT "event_staff_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_status_log"
    ADD CONSTRAINT "event_status_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_status_log"
    ADD CONSTRAINT "event_status_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_responsavel_interno_fkey" FOREIGN KEY ("responsavel_interno") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_de_employee_id_fkey" FOREIGN KEY ("de_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_para_employee_id_fkey" FOREIGN KEY ("para_employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."financeiro_importacoes"
    ADD CONSTRAINT "financeiro_importacoes_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."financeiro_importacoes"
    ADD CONSTRAINT "financeiro_importacoes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."financeiro_revisoes"
    ADD CONSTRAINT "financeiro_revisoes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."folha_empresa"
    ADD CONSTRAINT "folha_empresa_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."fornecedores_depara"
    ADD CONSTRAINT "fornecedores_depara_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id");



ALTER TABLE ONLY "public"."gorjeta_cargo_pontos"
    ADD CONSTRAINT "gorjeta_cargo_pontos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_dias"
    ADD CONSTRAINT "gorjeta_dias_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_dias"
    ADD CONSTRAINT "gorjeta_dias_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."gorjeta_periodos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_dias"
    ADD CONSTRAINT "gorjeta_dias_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_distribuicao"
    ADD CONSTRAINT "gorjeta_distribuicao_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."gorjeta_distribuicao"
    ADD CONSTRAINT "gorjeta_distribuicao_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_distribuicao"
    ADD CONSTRAINT "gorjeta_distribuicao_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gorjeta_periodos"
    ADD CONSTRAINT "gorjeta_periodos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."hos_approvals"
    ADD CONSTRAINT "hos_approvals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."hos_runs"("id");



ALTER TABLE ONLY "public"."hos_approvals"
    ADD CONSTRAINT "hos_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."hos_jobs"
    ADD CONSTRAINT "hos_jobs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hos_runs"
    ADD CONSTRAINT "hos_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."hos_runs"
    ADD CONSTRAINT "hos_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."hos_jobs"("id");



ALTER TABLE ONLY "public"."hour_bank"
    ADD CONSTRAINT "hour_bank_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."hour_bank"
    ADD CONSTRAINT "hour_bank_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."hr_policies"
    ADD CONSTRAINT "hr_policies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."import_logs"
    ADD CONSTRAINT "import_logs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."ingredient_price_history"
    ADD CONSTRAINT "ingredient_price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingredient_price_history"
    ADD CONSTRAINT "ingredient_price_history_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_stock"
    ADD CONSTRAINT "ingredient_stock_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "public"."job_openings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_responses"
    ADD CONSTRAINT "interview_responses_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_responses"
    ADD CONSTRAINT "interview_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_entrevistador_id_fkey" FOREIGN KEY ("entrevistador_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "public"."job_openings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id");



ALTER TABLE ONLY "public"."job_descriptions"
    ADD CONSTRAINT "job_descriptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_opening_logs"
    ADD CONSTRAINT "job_opening_logs_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "public"."job_openings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_cargo_grupo_id_fkey" FOREIGN KEY ("cargo_grupo_id") REFERENCES "public"."cargo_grupos"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_entrevistador_id_fkey" FOREIGN KEY ("entrevistador_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_substituido_id_fkey" FOREIGN KEY ("substituido_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."lancamentos"
    ADD CONSTRAINT "lancamentos_conta_codigo_fkey" FOREIGN KEY ("conta_codigo") REFERENCES "public"."plano_contas"("codigo");



ALTER TABLE ONLY "public"."manutencao_aprovacoes"
    ADD CONSTRAINT "manutencao_aprovacoes_chamado_id_fkey" FOREIGN KEY ("chamado_id") REFERENCES "public"."manutencao_chamados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manutencao_parcelas"
    ADD CONSTRAINT "manutencao_parcelas_aprovacao_id_fkey" FOREIGN KEY ("aprovacao_id") REFERENCES "public"."manutencao_aprovacoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_conta_codigo_fkey" FOREIGN KEY ("conta_codigo") REFERENCES "public"."plano_contas"("codigo");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas_bancarias"("id");



ALTER TABLE ONLY "public"."movimentacoes_caixa"
    ADD CONSTRAINT "movimentacoes_caixa_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."movimentacoes_rh"
    ADD CONSTRAINT "movimentacoes_rh_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."movimentacoes_rh"
    ADD CONSTRAINT "movimentacoes_rh_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_rh"
    ADD CONSTRAINT "movimentacoes_rh_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."movimentacoes_rh"
    ADD CONSTRAINT "movimentacoes_rh_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."nfe_documentos"
    ADD CONSTRAINT "nfe_documentos_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "public"."nfe_importacoes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."nfe_documentos"
    ADD CONSTRAINT "nfe_documentos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."nfe_importacoes"
    ADD CONSTRAINT "nfe_importacoes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."occupational_health"
    ADD CONSTRAINT "occupational_health_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."occupational_health"
    ADD CONSTRAINT "occupational_health_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_concluido_por_fkey" FOREIGN KEY ("concluido_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."onboarding_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "public"."onboarding_tarefas"("id");



ALTER TABLE ONLY "public"."onboarding_runs"
    ADD CONSTRAINT "onboarding_runs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."onboarding_runs"
    ADD CONSTRAINT "onboarding_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id");



ALTER TABLE ONLY "public"."onboarding_runs"
    ADD CONSTRAINT "onboarding_runs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."onboarding_tarefas"
    ADD CONSTRAINT "onboarding_tarefas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."onboarding_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_templates"
    ADD CONSTRAINT "onboarding_templates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."overtime_records"
    ADD CONSTRAINT "overtime_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."overtime_records"
    ADD CONSTRAINT "overtime_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."overtime_records"
    ADD CONSTRAINT "overtime_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_dominio_cadastro"
    ADD CONSTRAINT "payroll_dominio_cadastro_cod_empresa_fkey" FOREIGN KEY ("cod_empresa") REFERENCES "public"."payroll_dominio_empresa"("cod_empresa");



ALTER TABLE ONLY "public"."payroll_dominio_cadastro"
    ADD CONSTRAINT "payroll_dominio_cadastro_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_colaborador"
    ADD CONSTRAINT "payroll_extrato_dominio_colaborador_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_colaborador"
    ADD CONSTRAINT "payroll_extrato_dominio_colaborador_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_competencia"
    ADD CONSTRAINT "payroll_extrato_dominio_competencia_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_linha"
    ADD CONSTRAINT "payroll_extrato_dominio_linha_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_linha"
    ADD CONSTRAINT "payroll_extrato_dominio_linha_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_rubrica"
    ADD CONSTRAINT "payroll_extrato_dominio_rubrica_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payroll_extrato_dominio_totais"
    ADD CONSTRAINT "payroll_extrato_dominio_totais_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payroll_fechamento_linha"
    ADD CONSTRAINT "payroll_fechamento_linha_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."payroll_fechamento_linha"
    ADD CONSTRAINT "payroll_fechamento_linha_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."payroll_fechamento_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_fechamento_linha"
    ADD CONSTRAINT "payroll_fechamento_linha_rubrica_id_fkey" FOREIGN KEY ("rubrica_id") REFERENCES "public"."payroll_rubricas"("id");



ALTER TABLE ONLY "public"."payroll_fechamento_periodo"
    ADD CONSTRAINT "payroll_fechamento_periodo_gerado_por_fkey" FOREIGN KEY ("gerado_por") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payroll_fechamento_periodo"
    ADD CONSTRAINT "payroll_fechamento_periodo_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."pdi_metas"
    ADD CONSTRAINT "pdi_metas_pdi_id_fkey" FOREIGN KEY ("pdi_id") REFERENCES "public"."pdis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "public"."performance_reviews"("id");



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."pdis"
    ADD CONSTRAINT "pdis_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_reviews"
    ADD CONSTRAINT "performance_reviews_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."performance_templates"("id");



ALTER TABLE ONLY "public"."performance_templates"
    ADD CONSTRAINT "performance_templates_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."performance_templates"
    ADD CONSTRAINT "performance_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."performance_templates"
    ADD CONSTRAINT "performance_templates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."plan_members"
    ADD CONSTRAINT "plan_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_members"
    ADD CONSTRAINT "plan_members_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ponto_mensal"
    ADD CONSTRAINT "ponto_mensal_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ponto_mensal"
    ADD CONSTRAINT "ponto_mensal_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_quote_items"
    ADD CONSTRAINT "price_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."price_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_quotes"
    ADD CONSTRAINT "price_quotes_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."produtos_depara"
    ADD CONSTRAINT "produtos_depara_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos_catalogo"("id");



ALTER TABLE ONLY "public"."produtos_relatorio"
    ADD CONSTRAINT "produtos_relatorio_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "public"."financeiro_importacoes"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_invites"
    ADD CONSTRAINT "project_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_invites"
    ADD CONSTRAINT "project_invites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."protestos_registros"
    ADD CONSTRAINT "protestos_registros_certidao_id_fkey" FOREIGN KEY ("certidao_id") REFERENCES "public"."protestos_certidoes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punch_adjustment_requests"
    ADD CONSTRAINT "punch_adjustment_requests_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."punch_adjustment_requests"
    ADD CONSTRAINT "punch_adjustment_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_invoice_items"
    ADD CONSTRAINT "purchase_invoice_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_invoice_items"
    ADD CONSTRAINT "purchase_invoice_items_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."quadro_ideal"
    ADD CONSTRAINT "quadro_ideal_cargo_grupo_id_fkey" FOREIGN KEY ("cargo_grupo_id") REFERENCES "public"."cargo_grupos"("id");



ALTER TABLE ONLY "public"."quadro_ideal"
    ADD CONSTRAINT "quadro_ideal_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id");



ALTER TABLE ONLY "public"."quadro_ideal"
    ADD CONSTRAINT "quadro_ideal_reporta_a_cargo_id_fkey" FOREIGN KEY ("reporta_a_cargo_id") REFERENCES "public"."cargos"("id");



ALTER TABLE ONLY "public"."quadro_ideal"
    ADD CONSTRAINT "quadro_ideal_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."quality_checklists"
    ADD CONSTRAINT "quality_checklists_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recebimento_itens"
    ADD CONSTRAINT "recebimento_itens_pedido_item_id_fkey" FOREIGN KEY ("pedido_item_id") REFERENCES "public"."purchase_order_items"("id");



ALTER TABLE ONLY "public"."recebimento_itens"
    ADD CONSTRAINT "recebimento_itens_recebimento_id_fkey" FOREIGN KEY ("recebimento_id") REFERENCES "public"."recebimentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recebimentos"
    ADD CONSTRAINT "recebimentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recebiveis_cartao"
    ADD CONSTRAINT "recebiveis_cartao_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."receita_ambientes"
    ADD CONSTRAINT "receita_ambientes_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_caixas"
    ADD CONSTRAINT "receita_caixas_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_cancelamentos_detalhe"
    ADD CONSTRAINT "receita_cancelamentos_detalhe_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_cancelamentos"
    ADD CONSTRAINT "receita_cancelamentos_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_descontos_detalhe"
    ADD CONSTRAINT "receita_descontos_detalhe_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_descontos"
    ADD CONSTRAINT "receita_descontos_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_dias"
    ADD CONSTRAINT "receita_dias_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "public"."financeiro_importacoes"("id");



ALTER TABLE ONLY "public"."receita_dias"
    ADD CONSTRAINT "receita_dias_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."receita_grupos"
    ADD CONSTRAINT "receita_grupos_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_horarios"
    ADD CONSTRAINT "receita_horarios_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_pagamentos"
    ADD CONSTRAINT "receita_pagamentos_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_produtos_dia"
    ADD CONSTRAINT "receita_produtos_dia_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_turnos"
    ADD CONSTRAINT "receita_turnos_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."receita_usuarios"
    ADD CONSTRAINT "receita_usuarios_workday_id_fk_fkey" FOREIGN KEY ("workday_id_fk") REFERENCES "public"."receita_dias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_items"
    ADD CONSTRAINT "recipe_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recipe_items"
    ADD CONSTRAINT "recipe_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recipe_notes"
    ADD CONSTRAINT "recipe_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recipe_notes"
    ADD CONSTRAINT "recipe_notes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regras_classificacao"
    ADD CONSTRAINT "regras_classificacao_conta_codigo_fkey" FOREIGN KEY ("conta_codigo") REFERENCES "public"."plano_contas"("codigo");



ALTER TABLE ONLY "public"."relatorio_produtos"
    ADD CONSTRAINT "relatorio_produtos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_confirmado_por_fkey" FOREIGN KEY ("confirmado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reuniao_action_items"
    ADD CONSTRAINT "reuniao_action_items_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."reuniao_action_items"
    ADD CONSTRAINT "reuniao_action_items_reuniao_id_fkey" FOREIGN KEY ("reuniao_id") REFERENCES "public"."reunioes_1on1"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reunioes_1on1"
    ADD CONSTRAINT "reunioes_1on1_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."reunioes_1on1"
    ADD CONSTRAINT "reunioes_1on1_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."reunioes_1on1"
    ADD CONSTRAINT "reunioes_1on1_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."reunioes_1on1"
    ADD CONSTRAINT "reunioes_1on1_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."score_events"
    ADD CONSTRAINT "score_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."sick_leaves"
    ADD CONSTRAINT "sick_leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."sick_leaves"
    ADD CONSTRAINT "sick_leaves_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."target_notes"
    ADD CONSTRAINT "target_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."target_notes"
    ADD CONSTRAINT "target_notes_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."brand_targets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignees"
    ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."terminations"
    ADD CONSTRAINT "terminations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."terminations"
    ADD CONSTRAINT "terminations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."theo_tickets"
    ADD CONSTRAINT "theo_tickets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."time_bank_balance"
    ADD CONSTRAINT "time_bank_balance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clock_punches"
    ADD CONSTRAINT "time_clock_punches_aprovado_por_fkey" FOREIGN KEY ("aprovado_por") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."time_clock_punches"
    ADD CONSTRAINT "time_clock_punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_records"
    ADD CONSTRAINT "time_records_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."titulo_pagamentos"
    ADD CONSTRAINT "titulo_pagamentos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "public"."contas_bancarias"("id");



ALTER TABLE ONLY "public"."titulo_pagamentos"
    ADD CONSTRAINT "titulo_pagamentos_titulo_id_fkey" FOREIGN KEY ("titulo_id") REFERENCES "public"."titulos_a_pagar"("id");



ALTER TABLE ONLY "public"."titulo_pagamentos"
    ADD CONSTRAINT "titulo_pagamentos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."titulos_a_pagar"
    ADD CONSTRAINT "titulos_a_pagar_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "public"."financeiro_importacoes"("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."trainings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_records"
    ADD CONSTRAINT "training_records_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."training_templates"("id");



ALTER TABLE ONLY "public"."training_templates"
    ADD CONSTRAINT "training_templates_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id");



ALTER TABLE ONLY "public"."training_templates"
    ADD CONSTRAINT "training_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_templates"
    ADD CONSTRAINT "training_templates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."trainings"
    ADD CONSTRAINT "trainings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."transport_vouchers"
    ADD CONSTRAINT "transport_vouchers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transport_vouchers"
    ADD CONSTRAINT "transport_vouchers_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."uniforms"
    ADD CONSTRAINT "uniforms_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."uniforms"
    ADD CONSTRAINT "uniforms_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."unit_cnpjs"
    ADD CONSTRAINT "unit_cnpjs_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_schedules"
    ADD CONSTRAINT "vacation_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."vacation_schedules"
    ADD CONSTRAINT "vacation_schedules_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."vendas_consolidado_ambiente"
    ADD CONSTRAINT "vendas_consolidado_ambiente_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_dia_semana"
    ADD CONSTRAINT "vendas_consolidado_dia_semana_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_funcionarios"
    ADD CONSTRAINT "vendas_consolidado_funcionarios_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_mensal"
    ADD CONSTRAINT "vendas_consolidado_mensal_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_produtos"
    ADD CONSTRAINT "vendas_consolidado_produtos_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_resumo"
    ADD CONSTRAINT "vendas_consolidado_resumo_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendas_consolidado_turno"
    ADD CONSTRAINT "vendas_consolidado_turno_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "public"."vendas_consolidado_periodo"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warnings"
    ADD CONSTRAINT "warnings_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."work_schedules"
    ADD CONSTRAINT "work_schedules_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



CREATE POLICY "anon_read" ON "mise"."inventory_count_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."inventory_counts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."labels" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."production_orders" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."receiving_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."receiving_records" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."shelf_life_rules" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_read" ON "mise"."waste_records" FOR SELECT TO "anon" USING (true);



ALTER TABLE "mise"."checklist_action_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."checklist_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."checklist_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."checklist_template_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."checklist_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."ingredient_shelf_life" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."inventory_count_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."inventory_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."print_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."production_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."receiving_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."receiving_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."responsaveis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."responsavel_unidades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all" ON "mise"."inventory_count_items" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."inventory_counts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."labels" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."print_points" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."production_orders" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."receiving_items" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."receiving_records" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "service_role_all" ON "mise"."waste_records" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "mise"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."shelf_life_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."user_pins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "mise"."waste_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "opx"."event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "opx"."evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admin vê jobs" ON "public"."hos_jobs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_id" = ANY (ARRAY['0580a0a6-48c9-4170-b74d-84fd23e815fc'::"uuid", '086f0247-6407-4cdf-9c12-6e12ca2dbaf7'::"uuid", 'ba89b7b1-cea2-4622-b2f3-2623817d08aa'::"uuid"]))))));



CREATE POLICY "Admin vê runs" ON "public"."hos_runs" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_id" = ANY (ARRAY['0580a0a6-48c9-4170-b74d-84fd23e815fc'::"uuid", '086f0247-6407-4cdf-9c12-6e12ca2dbaf7'::"uuid", 'ba89b7b1-cea2-4622-b2f3-2623817d08aa'::"uuid"]))))));



CREATE POLICY "Admins podem atualizar execucoes" ON "public"."hos_runs" FOR UPDATE TO "authenticated" USING (("public"."kph_has_role_for_unit"(NULL::"uuid") OR "public"."kph_is_founder"())) WITH CHECK (("public"."kph_has_role_for_unit"(NULL::"uuid") OR "public"."kph_is_founder"()));



CREATE POLICY "Admins podem inserir insights" ON "public"."hos_insights" FOR INSERT TO "authenticated" WITH CHECK (("public"."kph_has_role_for_unit"(NULL::"uuid") OR "public"."kph_is_founder"()));



CREATE POLICY "Admins podem ver insights" ON "public"."hos_insights" FOR SELECT TO "authenticated" USING (("public"."kph_has_role_for_unit"(NULL::"uuid") OR "public"."kph_is_founder"()));



CREATE POLICY "Allow anonymous inserts" ON "public"."job_requisitions" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow authenticated reads" ON "public"."job_requisitions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."Comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Founder aprova" ON "public"."hos_approvals" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_id" = '0580a0a6-48c9-4170-b74d-84fd23e815fc'::"uuid")))));



CREATE POLICY "Permitir edicao" ON "public"."job_requisitions" FOR UPDATE USING (true);



CREATE POLICY "Permitir exclusao" ON "public"."job_requisitions" FOR DELETE USING (true);



CREATE POLICY "Permitir leitura" ON "public"."job_requisitions" FOR SELECT USING (true);



ALTER TABLE "public"."Projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Task_Assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Team_Members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."absences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "absences_all" ON "public"."absences" USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "absences"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."access_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "action_items_access" ON "public"."reuniao_action_items" USING (("reuniao_id" IN ( SELECT "reunioes_1on1"."id"
   FROM "public"."reunioes_1on1"
  WHERE ("reunioes_1on1"."unit_id" IN ( SELECT "user_roles"."unit_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "action_items_read" ON "public"."reuniao_action_items" FOR SELECT USING (("reuniao_id" IN ( SELECT "reunioes_1on1"."id"
   FROM "public"."reunioes_1on1")));



CREATE POLICY "action_items_write" ON "public"."reuniao_action_items" USING ((("reuniao_id" IN ( SELECT "r"."id"
   FROM ("public"."reunioes_1on1" "r"
     JOIN "public"."employees" "eg" ON ((("eg"."id" = "r"."gestor_id") AND ("eg"."user_id" = "auth"."uid"())))))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



ALTER TABLE "public"."action_plan_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."action_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agendamentos_all" ON "public"."candidate_agendamentos" USING (true) WITH CHECK (true);



ALTER TABLE "public"."agent_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_conversations_deny_anon" ON "public"."agent_conversations" TO "anon" USING (false);



CREATE POLICY "agent_conversations_select" ON "public"."agent_conversations" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])) OR ("operator_id" = "auth"."uid"())));



CREATE POLICY "agent_conversations_update" ON "public"."agent_conversations" FOR UPDATE TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])) OR ("operator_id" = "auth"."uid"())));



ALTER TABLE "public"."agent_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_prompt_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_all_climate_questions" ON "public"."climate_questions" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "anon_all_climate_responses" ON "public"."climate_responses" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "anon_all_climate_surveys" ON "public"."climate_surveys" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "anon_all_punch_adj" ON "public"."punch_adjustment_requests" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "anyone_insert" ON "public"."access_requests" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "approver_update" ON "public"."access_requests" FOR UPDATE TO "authenticated" USING (((("public"."get_my_tier"() = 'T2A'::"text") AND ("approver_tier" = 'T2A'::"text")) OR (("public"."get_my_tier"() = 'T3'::"text") AND ("approver_tier" = 'T3'::"text") AND ("public"."get_my_dept"() = 'pessoas'::"text")) OR ("public"."get_my_tier"() = 'T4'::"text")));



ALTER TABLE "public"."attendance_summaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_insert_service" ON "public"."audit_log" FOR INSERT TO "service_role" WITH CHECK (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."auth_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated insert agent_runs" ON "public"."agent_runs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated insert orkestri_achados" ON "public"."orkestri_achados" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated insert orquestrador_jobs" ON "public"."orquestrador_jobs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated read agent_runs" ON "public"."agent_runs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated read learning_machine_reports" ON "public"."learning_machine_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated read orkestri_achados" ON "public"."orkestri_achados" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated read orquestrador_jobs" ON "public"."orquestrador_jobs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated update learning_machine_reports" ON "public"."learning_machine_reports" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "authenticated upsert learning_machine_reports" ON "public"."learning_machine_reports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "av_ciclos_read" ON "public"."avaliacao_ciclos" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "av_ciclos_write" ON "public"."avaliacao_ciclos" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "av_part_read" ON "public"."avaliacao_participantes" FOR SELECT USING ((("avaliado_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("avaliador_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "av_part_write" ON "public"."avaliacao_participantes" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."avaliacao_ciclos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacao_participantes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brand_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brand_links_select" ON "public"."brand_links" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "brand_links_write" ON "public"."brand_links" USING ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."brand_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."brands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "brands_delete" ON "public"."brands" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "brands_insert" ON "public"."brands" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "brands_read" ON "public"."brands" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "brands_select" ON "public"."brands" FOR SELECT TO "authenticated" USING ("public"."kph_has_role_for_brand"("id"));



CREATE POLICY "brands_update" ON "public"."brands" FOR UPDATE TO "authenticated" USING (("public"."kph_is_founder"() OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."brand_id" = "brands"."id") AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text"]))))))) WITH CHECK (("public"."kph_is_founder"() OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."brand_id" = "brands"."id") AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text"])))))));



CREATE POLICY "bt_delete" ON "public"."brand_targets" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "bt_insert" ON "public"."brand_targets" FOR INSERT WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "bt_select" ON "public"."brand_targets" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "bt_update" ON "public"."brand_targets" FOR UPDATE USING ("public"."kph_has_role_for_brand"("brand_id")) WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_delete" ON "public"."campaigns" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "campaigns_insert" ON "public"."campaigns" FOR INSERT WITH CHECK (((("brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("brand_id")) OR (("unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("unit_id"))));



CREATE POLICY "campaigns_select" ON "public"."campaigns" FOR SELECT USING (((("brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("brand_id")) OR (("unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("unit_id")) OR "public"."kph_is_founder"()));



CREATE POLICY "campaigns_update" ON "public"."campaigns" FOR UPDATE USING (((("brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("brand_id")) OR (("unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("unit_id"))));



ALTER TABLE "public"."candidate_agendamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_avaliacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_feedback_operacional" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_pipeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_pipeline_read" ON "public"."candidate_pipeline" FOR SELECT USING (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates")));



CREATE POLICY "candidate_pipeline_write" ON "public"."candidate_pipeline" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidates_delete" ON "public"."candidates" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "candidates_insert" ON "public"."candidates" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "j"
  WHERE (("j"."id" = "candidates"."job_opening_id") AND ((("j"."brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("j"."brand_id")) OR (("j"."unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("j"."unit_id")))))));



CREATE POLICY "candidates_read" ON "public"."candidates" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "candidates_select" ON "public"."candidates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text", 'pessoas'::"text"]))))));



CREATE POLICY "candidates_select_admin" ON "public"."candidates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "j"
  WHERE (("j"."id" = "candidates"."job_opening_id") AND ((("j"."brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("j"."brand_id")) OR (("j"."unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("j"."unit_id")) OR "public"."kph_is_founder"())))));



CREATE POLICY "candidates_select_public" ON "public"."candidates" FOR SELECT USING (true);



CREATE POLICY "candidates_update" ON "public"."candidates" FOR UPDATE USING (true);



CREATE POLICY "candidates_write" ON "public"."candidates" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."candidatos_maya" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidatos_maya_select" ON "public"."candidatos_maya" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text", 'pessoas'::"text"]))))));



ALTER TABLE "public"."cargo_grupos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cargo_grupos_select" ON "public"."cargo_grupos" FOR SELECT USING (true);



ALTER TABLE "public"."cargo_salarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cargos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cav_all" ON "public"."candidate_avaliacao" USING (true) WITH CHECK (true);



CREATE POLICY "cct_select" ON "public"."cct_versions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cct_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checklist_access" ON "public"."onboarding_checklist" USING (("run_id" IN ( SELECT "onboarding_runs"."id"
   FROM "public"."onboarding_runs"
  WHERE ("onboarding_runs"."unit_id" IN ( SELECT "user_roles"."unit_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."checklist_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ciclo_unit_access" ON "public"."avaliacao_participantes" USING (("ciclo_id" IN ( SELECT "avaliacao_ciclos"."id"
   FROM "public"."avaliacao_ciclos"
  WHERE ("avaliacao_ciclos"."unit_id" IN ( SELECT "user_roles"."unit_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."client_interactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_interactions_delete" ON "public"."client_interactions" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "client_interactions_insert" ON "public"."client_interactions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_interactions"."client_id") AND "public"."kph_has_role_for_unit"("c"."unit_id")))));



CREATE POLICY "client_interactions_select" ON "public"."client_interactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_interactions"."client_id") AND "public"."kph_has_role_for_unit"("c"."unit_id")))));



CREATE POLICY "client_interactions_update" ON "public"."client_interactions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_interactions"."client_id") AND "public"."kph_has_role_for_unit"("c"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."clients" "c"
  WHERE (("c"."id" = "client_interactions"."client_id") AND "public"."kph_has_role_for_unit"("c"."unit_id")))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_delete" ON "public"."clients" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "clients_insert" ON "public"."clients" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "clients_select" ON "public"."clients" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "clients_update" ON "public"."clients" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."climate_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."climate_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."climate_survey_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."climate_survey_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."climate_surveys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conferencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contas_bancarias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractor_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractor_vacations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contractors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contratos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contratos_arquivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_anon" ON "public"."access_requests" TO "anon" USING (false);



ALTER TABLE "public"."dependents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dependents_all" ON "public"."dependents" USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "dependents"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "dependents_select" ON "public"."dependents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "dependents"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."dho_tracking" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disc_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."disciplinary_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_delete" ON "public"."documents" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "documents_insert" ON "public"."documents" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "documents_update" ON "public"."documents" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."dre_contratos_fixos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_despesa_detalhada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_faturamento_historico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_folha" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_gorjeta_mensal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_indicadores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_kpis_mensais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_linhas_detalhadas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_manutencao_detalhada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_mensal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_pessoal_detalhado" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_prestadores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_receita_detalhada" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dre_snapshot" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emp_docs_delete" ON "public"."employee_documents" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "emp_docs_insert" ON "public"."employee_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_documents"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "emp_docs_select" ON "public"."employee_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_documents"."employee_id") AND (("e"."user_id" = "auth"."uid"()) OR "public"."kph_has_role_for_unit"("e"."unit_id"))))));



CREATE POLICY "emp_docs_update" ON "public"."employee_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_documents"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."employee_auth" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_auth_delete" ON "public"."employee_auth" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "employee_auth_insert" ON "public"."employee_auth" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_auth"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "employee_auth_login" ON "public"."employee_auth" FOR SELECT USING (true);



CREATE POLICY "employee_auth_select" ON "public"."employee_auth" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_auth"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "employee_auth_update" ON "public"."employee_auth" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "employee_auth"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."employee_availability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_availability_all" ON "public"."employee_availability" USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "employee_availability_select" ON "public"."employee_availability" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."employee_benefits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_delete" ON "public"."employees" FOR DELETE TO "authenticated" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "employees_select" ON "public"."employees" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"())) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "employees_self_select" ON "public"."employees" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"()))));



ALTER TABLE "public"."event_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_attachments_select" ON "public"."event_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_attachments"."event_id") AND "public"."kph_has_role_for_brand"("e"."brand_id")))));



CREATE POLICY "event_attachments_write" ON "public"."event_attachments" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_attachments"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_attachments"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id")))));



ALTER TABLE "public"."event_infra_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_infra_items_select" ON "public"."event_infra_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_infra_items"."event_id") AND "public"."kph_has_role_for_brand"("e"."brand_id")))));



CREATE POLICY "event_infra_items_write" ON "public"."event_infra_items" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_infra_items"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_infra_items"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id")))));



ALTER TABLE "public"."event_menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_menu_items_select" ON "public"."event_menu_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_menu_items"."event_id") AND "public"."kph_has_role_for_brand"("e"."brand_id")))));



CREATE POLICY "event_menu_items_write" ON "public"."event_menu_items" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_menu_items"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_menu_items"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id")))));



ALTER TABLE "public"."event_staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_staff_select" ON "public"."event_staff" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_staff"."event_id") AND "public"."kph_has_role_for_brand"("e"."brand_id")))));



CREATE POLICY "event_staff_write" ON "public"."event_staff" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_staff"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_staff"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id")))));



ALTER TABLE "public"."event_status_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_status_log_select" ON "public"."event_status_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_status_log"."event_id") AND "public"."kph_has_role_for_brand"("e"."brand_id")))));



CREATE POLICY "event_status_log_write" ON "public"."event_status_log" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_status_log"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_status_log"."event_id") AND "public"."kph_can_write_event_brand"("e"."brand_id")))));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_delete" ON "public"."events" FOR DELETE USING ("public"."kph_can_delete_event_brand"("brand_id"));



CREATE POLICY "events_insert" ON "public"."events" FOR INSERT WITH CHECK ("public"."kph_can_write_event_brand"("brand_id"));



CREATE POLICY "events_select" ON "public"."events" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "events_update" ON "public"."events" FOR UPDATE USING ("public"."kph_can_write_event_brand"("brand_id"));



ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_op_all" ON "public"."candidate_feedback_operacional" USING (true) WITH CHECK (true);



ALTER TABLE "public"."feedbacks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedbacks_insert" ON "public"."feedbacks" FOR INSERT WITH CHECK ((("de_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "feedbacks_read" ON "public"."feedbacks" FOR SELECT USING ((("para_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("de_employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "financeiro_delete" ON "public"."conferencias" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."contas_bancarias" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."contratos" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."contratos_arquivos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contratos" "p"
  WHERE (("p"."id" = "contratos_arquivos"."contrato_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."dre_contratos_fixos" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_despesa_detalhada" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_faturamento_historico" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_folha" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_gorjeta_mensal" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_indicadores" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_kpis_mensais" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_linhas_detalhadas" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_manutencao_detalhada" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_mensal" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_pessoal_detalhado" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_prestadores" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_receita_detalhada" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."dre_snapshot" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."financeiro_importacoes" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."fornecedores" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."fornecedores_depara" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."kpi_snapshot" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."lancamentos" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."mapa_conta_dre" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."metas" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."movimentacoes_caixa" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."nfe_documentos" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."nfe_importacoes" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."payroll_extrato_dominio_colaborador" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."payroll_extrato_dominio_competencia" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."payroll_extrato_dominio_linha" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."payroll_extrato_dominio_rubrica" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."payroll_extrato_dominio_totais" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."plano_contas" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."produtos_catalogo" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."produtos_depara" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "financeiro_delete" ON "public"."produtos_relatorio" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."protestos_certidoes" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."protestos_registros" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."protestos_certidoes" "p"
  WHERE (("p"."id" = "protestos_registros"."certidao_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."recebiveis_cartao" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."receita_ambientes" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_ambientes"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_caixas" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_caixas"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_cancelamentos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_cancelamentos_detalhe" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_descontos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_descontos_detalhe" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_dias" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."receita_grupos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_grupos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_horarios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_horarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_pagamentos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_pagamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_produtos_dia" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_produtos_dia"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_turnos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_turnos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."receita_usuarios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_usuarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."reconciliacoes_sugeridas" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."regras_classificacao" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."titulo_override" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."titulos_a_pagar" "p"
  WHERE (("p"."id" = "titulo_override"."titulo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."titulos_a_pagar" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."unit_cnpjs" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_ambiente" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_ambiente"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_dia_semana" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_dia_semana"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_funcionarios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_funcionarios"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_mensal" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_mensal"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_periodo" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_produtos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_produtos"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_resumo" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_resumo"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_delete" ON "public"."vendas_consolidado_turno" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_turno"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



ALTER TABLE "public"."financeiro_importacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_insert" ON "public"."conferencias" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."contas_bancarias" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."contratos" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."contratos_arquivos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."contratos" "p"
  WHERE (("p"."id" = "contratos_arquivos"."contrato_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."dre_contratos_fixos" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_despesa_detalhada" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_faturamento_historico" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_folha" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_gorjeta_mensal" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_indicadores" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_kpis_mensais" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_linhas_detalhadas" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_manutencao_detalhada" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_mensal" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_pessoal_detalhado" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_prestadores" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_receita_detalhada" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."dre_snapshot" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."financeiro_importacoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."fornecedores" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."fornecedores_depara" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."kpi_snapshot" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."lancamentos" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."mapa_conta_dre" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."metas" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."movimentacoes_caixa" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."nfe_documentos" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."nfe_importacoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."payroll_extrato_dominio_colaborador" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."payroll_extrato_dominio_competencia" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."payroll_extrato_dominio_linha" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."payroll_extrato_dominio_rubrica" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."payroll_extrato_dominio_totais" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."plano_contas" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."produtos_catalogo" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."produtos_depara" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_insert" ON "public"."produtos_relatorio" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."protestos_certidoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."protestos_registros" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."protestos_certidoes" "p"
  WHERE (("p"."id" = "protestos_registros"."certidao_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."recebiveis_cartao" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."receita_ambientes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_ambientes"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_caixas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_caixas"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_cancelamentos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_cancelamentos_detalhe" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_descontos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_descontos_detalhe" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_dias" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."receita_grupos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_grupos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_horarios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_horarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_pagamentos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_pagamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_produtos_dia" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_produtos_dia"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_turnos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_turnos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."receita_usuarios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_usuarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."reconciliacoes_sugeridas" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."regras_classificacao" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."titulo_override" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."titulos_a_pagar" "p"
  WHERE (("p"."id" = "titulo_override"."titulo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."titulos_a_pagar" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."unit_cnpjs" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_ambiente" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_ambiente"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_dia_semana" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_dia_semana"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_funcionarios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_funcionarios"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_mensal" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_mensal"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_periodo" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_produtos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_produtos"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_resumo" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_resumo"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_insert" ON "public"."vendas_consolidado_turno" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_turno"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."conferencias" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."contas_bancarias" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."contratos" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."contratos_arquivos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contratos" "p"
  WHERE (("p"."id" = "contratos_arquivos"."contrato_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."dre_contratos_fixos" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_despesa_detalhada" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_faturamento_historico" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_folha" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_gorjeta_mensal" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_indicadores" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_kpis_mensais" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_linhas_detalhadas" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_manutencao_detalhada" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_mensal" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_pessoal_detalhado" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_prestadores" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_receita_detalhada" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."dre_snapshot" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."financeiro_importacoes" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."fornecedores" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."fornecedores_depara" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."kpi_snapshot" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."lancamentos" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."mapa_conta_dre" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."metas" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."movimentacoes_caixa" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."nfe_documentos" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."nfe_importacoes" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."payroll_extrato_dominio_colaborador" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."payroll_extrato_dominio_competencia" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."payroll_extrato_dominio_linha" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."payroll_extrato_dominio_rubrica" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."payroll_extrato_dominio_totais" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."plano_contas" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."produtos_catalogo" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."produtos_depara" FOR SELECT TO "authenticated" USING ("public"."financeiro_has_membership"());



CREATE POLICY "financeiro_read" ON "public"."produtos_relatorio" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."protestos_certidoes" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."protestos_registros" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."protestos_certidoes" "p"
  WHERE (("p"."id" = "protestos_registros"."certidao_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."recebiveis_cartao" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."receita_ambientes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_ambientes"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_caixas" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_caixas"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_cancelamentos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_cancelamentos_detalhe" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos_detalhe"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_descontos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_descontos_detalhe" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos_detalhe"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_dias" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."receita_grupos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_grupos"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_horarios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_horarios"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_pagamentos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_pagamentos"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_produtos_dia" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_produtos_dia"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_turnos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_turnos"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."receita_usuarios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_usuarios"."workday_id_fk") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."reconciliacoes_sugeridas" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."regras_classificacao" FOR SELECT TO "authenticated" USING (("public"."financeiro_can_read"("unit_id") OR (("unit_id" IS NULL) AND "public"."financeiro_has_membership"())));



CREATE POLICY "financeiro_read" ON "public"."titulo_override" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."titulos_a_pagar" "p"
  WHERE (("p"."id" = "titulo_override"."titulo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."titulos_a_pagar" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."unit_cnpjs" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_ambiente" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_ambiente"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_dia_semana" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_dia_semana"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_funcionarios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_funcionarios"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_mensal" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_mensal"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_periodo" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_produtos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_produtos"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_resumo" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_resumo"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_read" ON "public"."vendas_consolidado_turno" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_turno"."periodo_id") AND "public"."financeiro_can_read"("p"."unit_id")))));



CREATE POLICY "financeiro_revision_insert" ON "public"."financeiro_revisoes" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_revision_read" ON "public"."financeiro_revisoes" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "financeiro_revision_update" ON "public"."financeiro_revisoes" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



ALTER TABLE "public"."financeiro_revisoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financeiro_update" ON "public"."conferencias" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."contas_bancarias" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."contratos" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."contratos_arquivos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."contratos" "p"
  WHERE (("p"."id" = "contratos_arquivos"."contrato_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."contratos" "p"
  WHERE (("p"."id" = "contratos_arquivos"."contrato_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."dre_contratos_fixos" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_despesa_detalhada" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_faturamento_historico" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_folha" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_gorjeta_mensal" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_indicadores" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_kpis_mensais" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_linhas_detalhadas" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_manutencao_detalhada" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_mensal" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_pessoal_detalhado" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_prestadores" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_receita_detalhada" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."dre_snapshot" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."financeiro_importacoes" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."fornecedores" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."fornecedores_depara" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."kpi_snapshot" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."lancamentos" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."mapa_conta_dre" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."metas" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."movimentacoes_caixa" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."nfe_documentos" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."nfe_importacoes" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."payroll_extrato_dominio_colaborador" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."payroll_extrato_dominio_competencia" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."payroll_extrato_dominio_linha" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."payroll_extrato_dominio_rubrica" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."payroll_extrato_dominio_totais" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."plano_contas" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."produtos_catalogo" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."produtos_depara" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "financeiro_update" ON "public"."produtos_relatorio" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."protestos_certidoes" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."protestos_registros" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."protestos_certidoes" "p"
  WHERE (("p"."id" = "protestos_registros"."certidao_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."protestos_certidoes" "p"
  WHERE (("p"."id" = "protestos_registros"."certidao_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."recebiveis_cartao" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."receita_ambientes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_ambientes"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_ambientes"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_caixas" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_caixas"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_caixas"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_cancelamentos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_cancelamentos_detalhe" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_cancelamentos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_descontos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_descontos_detalhe" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_descontos_detalhe"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_dias" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."receita_grupos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_grupos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_grupos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_horarios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_horarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_horarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_pagamentos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_pagamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_pagamentos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_produtos_dia" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_produtos_dia"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_produtos_dia"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_turnos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_turnos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_turnos"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."receita_usuarios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_usuarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."receita_dias" "p"
  WHERE (("p"."id" = "receita_usuarios"."workday_id_fk") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."reconciliacoes_sugeridas" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."regras_classificacao" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."titulo_override" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."titulos_a_pagar" "p"
  WHERE (("p"."id" = "titulo_override"."titulo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."titulos_a_pagar" "p"
  WHERE (("p"."id" = "titulo_override"."titulo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."titulos_a_pagar" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."unit_cnpjs" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_ambiente" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_ambiente"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_ambiente"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_dia_semana" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_dia_semana"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_dia_semana"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_funcionarios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_funcionarios"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_funcionarios"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_mensal" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_mensal"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_mensal"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_periodo" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_produtos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_produtos"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_produtos"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_resumo" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_resumo"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_resumo"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



CREATE POLICY "financeiro_update" ON "public"."vendas_consolidado_turno" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_turno"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendas_consolidado_periodo" "p"
  WHERE (("p"."id" = "vendas_consolidado_turno"."periodo_id") AND "public"."financeiro_can_write"("p"."unit_id")))));



ALTER TABLE "public"."folha_empresa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "folha_empresa_insert" ON "public"."folha_empresa" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "folha_empresa_read" ON "public"."folha_empresa" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "folha_empresa_update" ON "public"."folha_empresa" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



ALTER TABLE "public"."fornecedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fornecedores_depara" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gorjeta_cargo_pontos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gorjeta_dias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gorjeta_distribuicao" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gorjeta_distribuicao_delete" ON "public"."gorjeta_distribuicao" FOR DELETE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "gorjeta_distribuicao_insert" ON "public"."gorjeta_distribuicao" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



CREATE POLICY "gorjeta_distribuicao_select" ON "public"."gorjeta_distribuicao" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"())) OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "gorjeta_distribuicao_update" ON "public"."gorjeta_distribuicao" FOR UPDATE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."gorjeta_periodos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gorjeta_periodos_insert" ON "public"."gorjeta_periodos" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



CREATE POLICY "gorjeta_periodos_select" ON "public"."gorjeta_periodos" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"()))));



CREATE POLICY "gorjeta_periodos_update" ON "public"."gorjeta_periodos" FOR UPDATE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_delete" ON "public"."groups" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "groups_insert" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "groups_read" ON "public"."groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "groups_select" ON "public"."groups" FOR SELECT TO "authenticated" USING ("public"."kph_has_role_for_group"("id"));



CREATE POLICY "groups_update" ON "public"."groups" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



ALTER TABLE "public"."hos_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hos_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hos_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hos_jobs_read_t3" ON "public"."hos_jobs" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "hos_jobs_write_t4" ON "public"."hos_jobs" USING (("public"."get_my_tier"() = 'T4'::"text"));



ALTER TABLE "public"."hos_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hour_bank" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hr_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_logs_insert" ON "public"."import_logs" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "import_logs_select" ON "public"."import_logs" FOR SELECT USING (("public"."kph_is_founder_or_cfo"() OR "public"."kph_has_role_for_unit"("unit_id")));



ALTER TABLE "public"."ingredient_price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredient_stock" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ingredients_delete" ON "public"."ingredients" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "ingredients_insert" ON "public"."ingredients" FOR INSERT WITH CHECK ("public"."kph_has_role_for_group"("group_id"));



CREATE POLICY "ingredients_select" ON "public"."ingredients" FOR SELECT USING ("public"."kph_has_role_for_group"("group_id"));



CREATE POLICY "ingredients_update" ON "public"."ingredients" FOR UPDATE USING ("public"."kph_has_role_for_group"("group_id")) WITH CHECK ("public"."kph_has_role_for_group"("group_id"));



CREATE POLICY "insert convidados" ON "public"."orkestri_leads" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "insert gorjeta_cargo_pontos" ON "public"."gorjeta_cargo_pontos" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "insert gorjeta_dias" ON "public"."gorjeta_dias" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "insert job_opening_logs" ON "public"."job_opening_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "jo"
  WHERE (("jo"."id" = "job_opening_logs"."opening_id") AND "public"."kph_has_role_for_unit"("jo"."unit_id")))));



CREATE POLICY "insert livre para convidados" ON "public"."orkestri_leads" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "insert_feedback" ON "public"."feedback" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "insert_own" ON "public"."page_views" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."interview_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interview_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interviews_read" ON "public"."interviews" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "interviews_write" ON "public"."interviews" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "invites_own" ON "public"."project_invites" USING (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."job_descriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_descriptions_delete" ON "public"."job_descriptions" FOR DELETE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "job_descriptions_insert" ON "public"."job_descriptions" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "job_descriptions_select" ON "public"."job_descriptions" FOR SELECT TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



CREATE POLICY "job_descriptions_update" ON "public"."job_descriptions" FOR UPDATE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."job_opening_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_openings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_openings_delete" ON "public"."job_openings" FOR DELETE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "job_openings_insert" ON "public"."job_openings" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



CREATE POLICY "job_openings_select" ON "public"."job_openings" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"()))));



CREATE POLICY "job_openings_update" ON "public"."job_openings" FOR UPDATE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."job_requisitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kph_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kph_alerts_manage" ON "public"."kph_alerts" USING ("public"."kph_is_founder_or_cfo"()) WITH CHECK ("public"."kph_is_founder_or_cfo"());



CREATE POLICY "kph_alerts_select" ON "public"."kph_alerts" FOR SELECT USING (("public"."kph_is_founder_or_cfo"() OR ("entidade_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."kph_insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kph_insights_manage" ON "public"."kph_insights" USING ("public"."kph_is_founder_or_cfo"()) WITH CHECK ("public"."kph_is_founder_or_cfo"());



CREATE POLICY "kph_insights_select" ON "public"."kph_insights" FOR SELECT USING ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."kph_intelligence_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kph_intelligence_scores_manage" ON "public"."kph_intelligence_scores" USING ("public"."kph_is_founder_or_cfo"()) WITH CHECK ("public"."kph_is_founder_or_cfo"());



CREATE POLICY "kph_intelligence_scores_select" ON "public"."kph_intelligence_scores" FOR SELECT USING ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."kph_learning_proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kph_learning_proposals_select" ON "public"."kph_learning_proposals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "kph_learning_proposals_update_founder" ON "public"."kph_learning_proposals" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK (("status" = ANY (ARRAY['approved'::"text", 'dismissed'::"text"])));



ALTER TABLE "public"."kpi_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lancamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_machine_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leitura admin" ON "public"."orkestri_leads" FOR SELECT TO "anon" USING (true);



CREATE POLICY "leitura livre para admin" ON "public"."orkestri_leads" FOR SELECT TO "anon" USING (true);



CREATE POLICY "manage_roadmap" ON "public"."roadmap_items" USING ("public"."kph_is_founder_or_cfo"()) WITH CHECK ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."manutencao_aprovacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manutencao_chamados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manutencao_parcelas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mapa_conta_dre" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_own" ON "public"."project_members" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "invited_by")));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_modify" ON "public"."menu_items" USING ("public"."kph_has_role_for_brand"("brand_id")) WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "menu_items_select" ON "public"."menu_items" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metas_dia_override" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."metas_dia_semana" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metas_excecoes_delete" ON "public"."metas_dia_override" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "metas_excecoes_insert" ON "public"."metas_dia_override" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "metas_excecoes_read" ON "public"."metas_dia_override" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "metas_excecoes_update" ON "public"."metas_dia_override" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "metas_semanais_delete" ON "public"."metas_dia_semana" FOR DELETE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "metas_semanais_insert" ON "public"."metas_dia_semana" FOR INSERT TO "authenticated" WITH CHECK ("public"."financeiro_can_write"("unit_id"));



CREATE POLICY "metas_semanais_read" ON "public"."metas_dia_semana" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



CREATE POLICY "metas_semanais_update" ON "public"."metas_dia_semana" FOR UPDATE TO "authenticated" USING ("public"."financeiro_can_write"("unit_id")) WITH CHECK ("public"."financeiro_can_write"("unit_id"));



ALTER TABLE "public"."movimentacoes_caixa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimentacoes_read_t3" ON "public"."movimentacoes_rh" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."movimentacoes_rh" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimentacoes_write_t4" ON "public"."movimentacoes_rh" USING (("public"."get_my_tier"() = 'T4'::"text"));



ALTER TABLE "public"."nfe_documentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nfe_importacoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notif_select_own" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notif_update_own" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_own" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ob_checklist_read" ON "public"."onboarding_checklist" FOR SELECT USING ((("run_id" IN ( SELECT "r"."id"
   FROM ("public"."onboarding_runs" "r"
     JOIN "public"."employees" "e" ON (("e"."id" = "r"."employee_id")))
  WHERE ("e"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "ob_checklist_write" ON "public"."onboarding_checklist" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "ob_runs_read" ON "public"."onboarding_runs" FOR SELECT USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "ob_runs_write" ON "public"."onboarding_runs" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "ob_tarefas_read" ON "public"."onboarding_tarefas" FOR SELECT USING (true);



CREATE POLICY "ob_tarefas_write" ON "public"."onboarding_tarefas" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "ob_templates_read" ON "public"."onboarding_templates" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "ob_templates_write" ON "public"."onboarding_templates" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."occupational_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_checklist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_tarefas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."origens_candidato" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "origens_candidato_select" ON "public"."origens_candidato" FOR SELECT USING (true);



ALTER TABLE "public"."orkestri_achados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orkestri_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orquestrador_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "overtime_delete" ON "public"."overtime_records" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "overtime_insert" ON "public"."overtime_records" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."overtime_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "overtime_select" ON "public"."overtime_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "overtime_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "overtime_update" ON "public"."overtime_records" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "p_cand_agend_all" ON "public"."candidate_agendamentos" USING (true) WITH CHECK (true);



CREATE POLICY "p_cand_feedback_op_all" ON "public"."candidate_feedback_operacional" USING (true) WITH CHECK (true);



CREATE POLICY "pagamentos_read" ON "public"."titulo_pagamentos" FOR SELECT TO "authenticated" USING ("public"."financeiro_can_read"("unit_id"));



ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_dominio_cadastro" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_dominio_cargo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_dominio_empresa" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_extrato_dominio_colaborador" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_extrato_dominio_competencia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_extrato_dominio_linha" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_extrato_dominio_rubrica" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_extrato_dominio_totais" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_fechamento_linha" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_fechamento_periodo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll_rubricas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payroll_rubricas_read" ON "public"."payroll_rubricas" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"])));



CREATE POLICY "payroll_rubricas_write" ON "public"."payroll_rubricas" USING (("public"."get_my_tier"() = ANY (ARRAY['T4'::"text", 'T5'::"text", 'T6'::"text"])));



ALTER TABLE "public"."payslips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payslips_delete" ON "public"."payslips" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "payslips_insert" ON "public"."payslips" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "payslips"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "payslips_select" ON "public"."payslips" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "payslips"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "payslips_update" ON "public"."payslips" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "payslips"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."pdi_metas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pdi_metas_access" ON "public"."pdi_metas" USING (("pdi_id" IN ( SELECT "pdis"."id"
   FROM "public"."pdis"
  WHERE ("pdis"."unit_id" IN ( SELECT "user_roles"."unit_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "pdi_metas_select" ON "public"."pdi_metas" FOR SELECT USING (("pdi_id" IN ( SELECT "pdis"."id"
   FROM "public"."pdis")));



CREATE POLICY "pdi_metas_write_t3" ON "public"."pdi_metas" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."pdis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pdis_select_own" ON "public"."pdis" FOR SELECT USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "pdis_write_t3" ON "public"."pdis" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "perf_reviews_read" ON "public"."performance_reviews" FOR SELECT USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "perf_reviews_write" ON "public"."performance_reviews" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "perf_templates_read" ON "public"."performance_templates" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "perf_templates_write" ON "public"."performance_templates" USING (("public"."get_my_tier"() = 'T4'::"text"));



ALTER TABLE "public"."performance_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pfl_read" ON "public"."payroll_fechamento_linha" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"])));



CREATE POLICY "pfl_write" ON "public"."payroll_fechamento_linha" USING (("public"."get_my_tier"() = ANY (ARRAY['T4'::"text", 'T5'::"text", 'T6'::"text"])));



CREATE POLICY "pfp_read" ON "public"."payroll_fechamento_periodo" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text", 'T5'::"text", 'T6'::"text"])));



CREATE POLICY "pfp_write" ON "public"."payroll_fechamento_periodo" USING (("public"."get_my_tier"() = ANY (ARRAY['T4'::"text", 'T5'::"text", 'T6'::"text"])));



ALTER TABLE "public"."plan_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plano_contas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "po_delete" ON "public"."purchase_orders" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "po_insert" ON "public"."purchase_orders" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "po_items_delete" ON "public"."purchase_order_items" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "po_items_insert" ON "public"."purchase_order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."order_id") AND "public"."kph_has_role_for_unit"("po"."unit_id")))));



CREATE POLICY "po_items_select" ON "public"."purchase_order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."order_id") AND "public"."kph_has_role_for_unit"("po"."unit_id")))));



CREATE POLICY "po_items_update" ON "public"."purchase_order_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."order_id") AND "public"."kph_has_role_for_unit"("po"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."order_id") AND "public"."kph_has_role_for_unit"("po"."unit_id")))));



CREATE POLICY "po_select" ON "public"."purchase_orders" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "po_update" ON "public"."purchase_orders" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."ponto_mensal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pr_delete" ON "public"."performance_reviews" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "pr_insert" ON "public"."performance_reviews" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "performance_reviews"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "pr_select" ON "public"."performance_reviews" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "performance_reviews"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "pr_update" ON "public"."performance_reviews" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "performance_reviews"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "performance_reviews"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "price_history_select" ON "public"."ingredient_price_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ingredients" "i"
  WHERE (("i"."id" = "ingredient_price_history"."ingredient_id") AND "public"."kph_has_role_for_group"("i"."group_id")))));



ALTER TABLE "public"."price_quote_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos_catalogo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos_depara" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."produtos_relatorio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_own" ON "public"."profiles" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."project_invites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prompt_versions_read_t3" ON "public"."agent_prompt_versions" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "prompt_versions_write_t4" ON "public"."agent_prompt_versions" USING (("public"."get_my_tier"() = 'T4'::"text"));



ALTER TABLE "public"."protestos_certidoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protestos_registros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pt_delete" ON "public"."performance_templates" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "pt_insert" ON "public"."performance_templates" FOR INSERT WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "pt_select" ON "public"."performance_templates" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "pt_update" ON "public"."performance_templates" FOR UPDATE USING ("public"."kph_has_role_for_brand"("brand_id")) WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



ALTER TABLE "public"."punch_adjustment_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "punches_delete" ON "public"."time_clock_punches" FOR DELETE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "punches_insert" ON "public"."time_clock_punches" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_my_unit"())))) OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "punches_select" ON "public"."time_clock_punches" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])) OR (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_my_unit"())))) OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"())))));



CREATE POLICY "punches_self_select" ON "public"."time_clock_punches" FOR SELECT TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "punches_update" ON "public"."time_clock_punches" FOR UPDATE TO "authenticated" USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."purchase_invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_invoice_items_delete" ON "public"."purchase_invoice_items" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "purchase_invoice_items_insert" ON "public"."purchase_invoice_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND "public"."kph_has_role_for_unit"("pi"."unit_id")))));



CREATE POLICY "purchase_invoice_items_select" ON "public"."purchase_invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND "public"."kph_has_role_for_unit"("pi"."unit_id")))));



CREATE POLICY "purchase_invoice_items_update" ON "public"."purchase_invoice_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND "public"."kph_has_role_for_unit"("pi"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND "public"."kph_has_role_for_unit"("pi"."unit_id")))));



ALTER TABLE "public"."purchase_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_invoices_delete" ON "public"."purchase_invoices" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "purchase_invoices_insert" ON "public"."purchase_invoices" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "purchase_invoices_select" ON "public"."purchase_invoices" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "purchase_invoices_update" ON "public"."purchase_invoices" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quadro_ideal" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quadro_ideal_insert" ON "public"."quadro_ideal" FOR INSERT WITH CHECK (true);



CREATE POLICY "quadro_ideal_select" ON "public"."quadro_ideal" FOR SELECT USING (true);



CREATE POLICY "quadro_ideal_update" ON "public"."quadro_ideal" FOR UPDATE USING (true);



ALTER TABLE "public"."quality_checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_delete" ON "public"."interview_questions" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "questions_insert" ON "public"."interview_questions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "j"
  WHERE (("j"."id" = "interview_questions"."job_opening_id") AND ((("j"."brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("j"."brand_id")) OR (("j"."unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("j"."unit_id")))))));



CREATE POLICY "questions_select" ON "public"."interview_questions" FOR SELECT USING (true);



CREATE POLICY "questions_update" ON "public"."interview_questions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "j"
  WHERE (("j"."id" = "interview_questions"."job_opening_id") AND ((("j"."brand_id" IS NOT NULL) AND "public"."kph_has_role_for_brand"("j"."brand_id")) OR (("j"."unit_id" IS NOT NULL) AND "public"."kph_has_role_for_unit"("j"."unit_id")))))));



ALTER TABLE "public"."recebimento_itens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recebimentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recebiveis_cartao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_ambientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_caixas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_cancelamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_cancelamentos_detalhe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_descontos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_descontos_detalhe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_dias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_grupos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_horarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_import_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_pagamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_produtos_dia" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_turnos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receita_usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipe_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reconciliacoes_sugeridas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regras_classificacao" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."relatorio_produtos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "responses_delete" ON "public"."interview_responses" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "responses_insert" ON "public"."interview_responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "responses_select" ON "public"."interview_responses" FOR SELECT USING (true);



CREATE POLICY "responses_update" ON "public"."interview_responses" FOR UPDATE USING (true);



ALTER TABLE "public"."reuniao_action_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reunioes_1on1" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reunioes_read" ON "public"."reunioes_1on1" FOR SELECT USING ((("gestor_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("colaborador_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "reunioes_write_t2" ON "public"."reunioes_1on1" USING ((("gestor_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "ri_delete" ON "public"."recipe_items" FOR DELETE USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "ri_insert" ON "public"."recipe_items" FOR INSERT WITH CHECK (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "ri_modify" ON "public"."recipe_items" USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id")))) WITH CHECK (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "ri_select" ON "public"."recipe_items" FOR SELECT USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "ri_update" ON "public"."recipe_items" FOR UPDATE USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id")))) WITH CHECK (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "rn_delete" ON "public"."recipe_notes" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "rn_insert" ON "public"."recipe_notes" FOR INSERT WITH CHECK (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



CREATE POLICY "rn_select" ON "public"."recipe_notes" FOR SELECT USING (("menu_item_id" IN ( SELECT "menu_items"."id"
   FROM "public"."menu_items"
  WHERE "public"."kph_has_role_for_brand"("menu_items"."brand_id"))));



ALTER TABLE "public"."roadmap_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_mutate" ON "public"."roles" TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "roles_read" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_select" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."score_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "score_insert" ON "public"."score_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "score_events"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "score_select" ON "public"."score_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "score_events"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "select gorjeta_cargo_pontos" ON "public"."gorjeta_cargo_pontos" FOR SELECT USING ((("unit_id" IS NULL) OR "public"."kph_has_role_for_unit"("unit_id")));



CREATE POLICY "select gorjeta_dias" ON "public"."gorjeta_dias" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "select job_opening_logs" ON "public"."job_opening_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."job_openings" "jo"
  WHERE (("jo"."id" = "job_opening_logs"."opening_id") AND "public"."kph_has_role_for_unit"("jo"."unit_id")))));



CREATE POLICY "select_feedback" ON "public"."feedback" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."kph_is_founder_or_cfo"()));



CREATE POLICY "select_own" ON "public"."page_views" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."kph_is_founder_or_cfo"()));



CREATE POLICY "select_roadmap" ON "public"."roadmap_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "service update orquestrador_jobs" ON "public"."orquestrador_jobs" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "service upsert orkestri_achados" ON "public"."orkestri_achados" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "service_role_full_access" ON "public"."documents" USING (true) WITH CHECK (true);



ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shifts_all" ON "public"."shifts" USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "shifts_select" ON "public"."shifts" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."sick_leaves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_delete" ON "public"."suppliers" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "suppliers_insert" ON "public"."suppliers" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "suppliers_select" ON "public"."suppliers" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "suppliers_update" ON "public"."suppliers" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "t1_own" ON "public"."attendance_summaries" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."employee_benefits" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."hour_bank" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."occupational_health" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."payslips" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."sick_leaves" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."vacation_schedules" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t1_own" ON "public"."work_schedules" FOR SELECT USING (("employee_id" = ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "t2a_read" ON "public"."document_templates" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text", 'T3'::"text", 'T4'::"text"])));



CREATE POLICY "t2a_read" ON "public"."hr_policies" FOR SELECT USING ((("public"."get_my_tier"() = ANY (ARRAY['T2A'::"text", 'T2B'::"text"])) AND ("unit_id" = "public"."get_my_unit"())));



CREATE POLICY "t2a_see_pending" ON "public"."access_requests" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = 'T2A'::"text") AND ("approver_tier" = 'T2A'::"text") AND (( SELECT "employees"."unit_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "access_requests"."employee_id")) = "public"."get_my_unit"())));



CREATE POLICY "t3_dept" ON "public"."attendance_summaries" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."dho_tracking" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."disc_profiles" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."disciplinary_actions" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."employee_benefits" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."hour_bank" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."hr_policies" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."job_openings" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."occupational_health" USING ((("public"."get_my_tier"() = 'T3'::"text") AND ("public"."get_my_dept"() = 'pessoas'::"text")));



CREATE POLICY "t3_dept" ON "public"."payslips" USING ((("public"."get_my_tier"() = 'T3'::"text") AND ("public"."get_my_dept"() = 'pessoas'::"text")));



CREATE POLICY "t3_dept" ON "public"."sick_leaves" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."terminations" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."uniforms" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."vacation_schedules" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_dept" ON "public"."work_schedules" USING (("public"."get_my_tier"() = 'T3'::"text"));



CREATE POLICY "t3_see_pending" ON "public"."access_requests" FOR SELECT TO "authenticated" USING ((("public"."get_my_tier"() = 'T3'::"text") AND ("approver_tier" = 'T3'::"text") AND ("public"."get_my_dept"() = 'pessoas'::"text")));



CREATE POLICY "t3_view" ON "public"."contractor_payments" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "t3_view" ON "public"."contractor_vacations" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "t3_view" ON "public"."contractors" FOR SELECT USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



CREATE POLICY "t4_master" ON "public"."access_requests" TO "authenticated" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."attendance_summaries" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."contractor_payments" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."contractor_vacations" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."contractors" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."dho_tracking" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."disc_profiles" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."disciplinary_actions" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."document_templates" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."employee_benefits" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."hour_bank" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."hr_policies" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."job_openings" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."occupational_health" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."payslips" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."sick_leaves" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."terminations" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."uniforms" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."vacation_schedules" USING (("public"."get_my_tier"() = 'T4'::"text"));



CREATE POLICY "t4_master" ON "public"."work_schedules" USING (("public"."get_my_tier"() = 'T4'::"text"));



ALTER TABLE "public"."target_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terminations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."theo_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "theo_tickets_select" ON "public"."theo_tickets" FOR SELECT TO "authenticated" USING (("public"."kph_is_founder"() OR (EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "theo_tickets"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id"))))));



ALTER TABLE "public"."time_bank_balance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_clock_punches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_records_delete" ON "public"."time_records" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "time_records_insert" ON "public"."time_records" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "time_records_select" ON "public"."time_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "time_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "time_records_update" ON "public"."time_records" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."titulo_override" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."titulo_pagamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."titulos_a_pagar" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tn_delete" ON "public"."target_notes" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "tn_insert" ON "public"."target_notes" FOR INSERT WITH CHECK (("target_id" IN ( SELECT "brand_targets"."id"
   FROM "public"."brand_targets"
  WHERE "public"."kph_has_role_for_brand"("brand_targets"."brand_id"))));



CREATE POLICY "tn_select" ON "public"."target_notes" FOR SELECT USING (("target_id" IN ( SELECT "brand_targets"."id"
   FROM "public"."brand_targets"
  WHERE "public"."kph_has_role_for_brand"("brand_targets"."brand_id"))));



CREATE POLICY "tr_delete" ON "public"."training_records" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "tr_insert" ON "public"."training_records" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "training_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "tr_select" ON "public"."training_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "training_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "tr_update" ON "public"."training_records" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "training_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "training_records"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."training_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_records_read" ON "public"."training_records" FOR SELECT USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"]))));



CREATE POLICY "training_records_write" ON "public"."training_records" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."training_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_templates_read" ON "public"."training_templates" FOR SELECT USING (true);



CREATE POLICY "training_templates_write" ON "public"."training_templates" USING (("public"."get_my_tier"() = ANY (ARRAY['T3'::"text", 'T4'::"text"])));



ALTER TABLE "public"."trainings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transport_vouchers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tt_delete" ON "public"."training_templates" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "tt_insert" ON "public"."training_templates" FOR INSERT WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "tt_select" ON "public"."training_templates" FOR SELECT USING ("public"."kph_has_role_for_brand"("brand_id"));



CREATE POLICY "tt_update" ON "public"."training_templates" FOR UPDATE USING ("public"."kph_has_role_for_brand"("brand_id")) WITH CHECK ("public"."kph_has_role_for_brand"("brand_id"));



ALTER TABLE "public"."uniforms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit members can delete quote items" ON "public"."price_quote_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."price_quotes" "q"
  WHERE (("q"."id" = "price_quote_items"."quote_id") AND "public"."kph_has_role_for_unit"("q"."unit_id")))));



CREATE POLICY "unit members can insert ponto_mensal" ON "public"."ponto_mensal" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can insert quote items" ON "public"."price_quote_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."price_quotes" "q"
  WHERE (("q"."id" = "price_quote_items"."quote_id") AND "public"."kph_has_role_for_unit"("q"."unit_id")))));



CREATE POLICY "unit members can insert quotes" ON "public"."price_quotes" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can insert records" ON "public"."checklist_records" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can insert reservations" ON "public"."reservations" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can manage checklists" ON "public"."quality_checklists" USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can select ponto_mensal" ON "public"."ponto_mensal" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can select quote items" ON "public"."price_quote_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."price_quotes" "q"
  WHERE (("q"."id" = "price_quote_items"."quote_id") AND "public"."kph_has_role_for_unit"("q"."unit_id")))));



CREATE POLICY "unit members can select quotes" ON "public"."price_quotes" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can select records" ON "public"."checklist_records" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can select reservations" ON "public"."reservations" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can update ponto_mensal" ON "public"."ponto_mensal" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can update quote items" ON "public"."price_quote_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."price_quotes" "q"
  WHERE (("q"."id" = "price_quote_items"."quote_id") AND "public"."kph_has_role_for_unit"("q"."unit_id")))));



CREATE POLICY "unit members can update quotes" ON "public"."price_quotes" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit members can update reservations" ON "public"."reservations" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id")) WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "unit_access" ON "public"."avaliacao_ciclos" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "unit_access" ON "public"."feedbacks" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "unit_access" ON "public"."pdis" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "unit_access" ON "public"."reunioes_1on1" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "unit_access_runs" ON "public"."onboarding_runs" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "unit_access_templates" ON "public"."onboarding_templates" USING (("unit_id" IN ( SELECT "user_roles"."unit_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."unit_cnpjs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "units_delete" ON "public"."units" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "units_insert" ON "public"."units" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "units_select" ON "public"."units" FOR SELECT TO "authenticated" USING ("public"."kph_has_role_for_unit"("id"));



CREATE POLICY "units_update" ON "public"."units" FOR UPDATE TO "authenticated" USING (("public"."kph_is_founder"() OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."unit_id" = "units"."id") AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text"]))))))) WITH CHECK (("public"."kph_is_founder"() OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."unit_id" = "units"."id") AND ("r"."name" = ANY (ARRAY['founder'::"text", 'gm'::"text"])))))));



CREATE POLICY "update gorjeta_cargo_pontos" ON "public"."gorjeta_cargo_pontos" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "update_status" ON "public"."feedback" FOR UPDATE USING ("public"."kph_is_founder_or_cfo"()) WITH CHECK ("public"."kph_is_founder_or_cfo"());



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."kph_is_founder"());



CREATE POLICY "user_roles_insert" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."kph_is_founder"());



CREATE POLICY "user_roles_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_roles_select" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."kph_is_founder"()));



CREATE POLICY "user_roles_update" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."kph_is_founder"()) WITH CHECK ("public"."kph_is_founder"());



ALTER TABLE "public"."vacation_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vacations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vacations_delete" ON "public"."vacations" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "vacations_insert" ON "public"."vacations" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "vacations_select" ON "public"."vacations" FOR SELECT USING ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "vacations_update" ON "public"."vacations" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."vendas_consolidado_ambiente" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_dia_semana" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_funcionarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_mensal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_periodo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_produtos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_resumo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendas_consolidado_turno" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vt_delete" ON "public"."transport_vouchers" FOR DELETE USING ("public"."kph_is_founder"());



CREATE POLICY "vt_insert" ON "public"."transport_vouchers" FOR INSERT WITH CHECK ("public"."kph_has_role_for_unit"("unit_id"));



CREATE POLICY "vt_select" ON "public"."transport_vouchers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "transport_vouchers"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



CREATE POLICY "vt_update" ON "public"."transport_vouchers" FOR UPDATE USING ("public"."kph_has_role_for_unit"("unit_id"));



ALTER TABLE "public"."warnings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "warnings_all" ON "public"."warnings" USING ((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = "warnings"."employee_id") AND "public"."kph_has_role_for_unit"("e"."unit_id")))));



ALTER TABLE "public"."work_schedules" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "mise" TO "anon";
GRANT USAGE ON SCHEMA "mise" TO "authenticated";
GRANT USAGE ON SCHEMA "mise" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_sync_employee_tier"() TO "anon";
GRANT ALL ON FUNCTION "public"."_sync_employee_tier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_sync_employee_tier"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."auth_rate_limit_check"("p_identifier_hash" "text", "p_action" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_rate_limit_check"("p_identifier_hash" "text", "p_action" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."auth_rate_limit_clear"("p_identifier_hash" "text", "p_action" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_rate_limit_clear"("p_identifier_hash" "text", "p_action" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."auth_rate_limit_fail"("p_identifier_hash" "text", "p_action" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_rate_limit_fail"("p_identifier_hash" "text", "p_action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."buscar_talentos"("p_statuses" "text"[], "p_termo" "text", "p_cargo" "text", "p_cidade" "text", "p_escolaridade" "text", "p_habilidade" "text", "p_turno" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_talentos"("p_statuses" "text"[], "p_termo" "text", "p_cargo" "text", "p_cidade" "text", "p_escolaridade" "text", "p_habilidade" "text", "p_turno" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."buscar_talentos"("p_statuses" "text"[], "p_termo" "text", "p_cargo" "text", "p_cidade" "text", "p_escolaridade" "text", "p_habilidade" "text", "p_turno" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("p_menu_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("p_menu_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_recipe_cost"("p_menu_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_primo_acesso"("p_cpf" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_primo_acesso"("p_cpf" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_primo_acesso"("p_cpf" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_survey_response"("p_employee_id" "uuid", "p_survey_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_survey_response"("p_employee_id" "uuid", "p_survey_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_survey_response"("p_employee_id" "uuid", "p_survey_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_employee_auth"("p_employee_id" "uuid", "p_cpf" "text", "p_password_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_employee_auth"("p_employee_id" "uuid", "p_cpf" "text", "p_password_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_employee_auth"("p_employee_id" "uuid", "p_cpf" "text", "p_password_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_punch_adjustment"("p_employee_id" "uuid", "p_data_referencia" "date", "p_horario_saida_almoco" time without time zone, "p_horario_retorno_almoco" time without time zone, "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_punch_adjustment"("p_employee_id" "uuid", "p_data_referencia" "date", "p_horario_saida_almoco" time without time zone, "p_horario_retorno_almoco" time without time zone, "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_punch_adjustment"("p_employee_id" "uuid", "p_data_referencia" "date", "p_horario_saida_almoco" time without time zone, "p_horario_retorno_almoco" time without time zone, "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."events_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_aplicar_lote"("p_operations" "jsonb", "p_expected" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_aplicar_lote"("p_operations" "jsonb", "p_expected" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_aplicar_lote"("p_operations" "jsonb", "p_expected" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_can_read"("p_unit" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_can_read"("p_unit" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_can_read"("p_unit" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_can_write"("p_unit" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_can_write"("p_unit" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_can_write"("p_unit" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_estornar_pagamento"("p_pagamento" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_estornar_pagamento"("p_pagamento" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_estornar_pagamento"("p_pagamento" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_has_membership"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_has_membership"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_has_membership"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_importar_produtos"("p_rows" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_importar_produtos"("p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_importar_produtos"("p_rows" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_importar_titulos"("p_rows" "jsonb", "p_operations" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_importar_titulos"("p_rows" "jsonb", "p_operations" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_importar_titulos"("p_rows" "jsonb", "p_operations" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_registrar_pagamento"("p_titulo" "text", "p_conta" "uuid", "p_data" "date", "p_valor" numeric, "p_comprovante" "text", "p_pedido" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_registrar_pagamento"("p_titulo" "text", "p_conta" "uuid", "p_data" "date", "p_valor" numeric, "p_comprovante" "text", "p_pedido" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_registrar_pagamento"("p_titulo" "text", "p_conta" "uuid", "p_data" "date", "p_valor" numeric, "p_comprovante" "text", "p_pedido" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_source_changed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_source_changed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_source_changed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."financeiro_storage_unit"("p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."financeiro_storage_unit"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."financeiro_storage_unit"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ingredient_price_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ingredient_price_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ingredient_price_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_oa_set_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_oa_set_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_oa_set_atualizado_em"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalc_menu_item_custo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalc_menu_item_custo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalc_menu_item_custo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_recalc_status_prazo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_recalc_status_prazo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_recalc_status_prazo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sync_qtd_alvo"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sync_qtd_alvo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sync_qtd_alvo"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."folha_empresa_competencias"("p_unit_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."folha_empresa_competencias"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."folha_empresa_competencias"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_campaigns"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_campaigns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_campaigns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_survey"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_survey"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_survey"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_auth_by_cpf"("p_cpf" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_auth_by_cpf"("p_cpf" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_by_cpf"("p_cpf" "text") TO "service_role";



GRANT ALL ON TABLE "public"."candidate_avaliacao" TO "anon";
GRANT ALL ON TABLE "public"."candidate_avaliacao" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_avaliacao" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_avaliacao"("p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_avaliacao"("p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_avaliacao"("p_candidate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cargo_salarios"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_cargo_salarios"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cargo_salarios"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cargos"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_cargos"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cargos"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_profile"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_profile"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_profile"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."candidate_feedback_operacional" TO "anon";
GRANT ALL ON TABLE "public"."candidate_feedback_operacional" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_feedback_operacional" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feedback_operacional"("p_candidate_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feedback_operacional"("p_candidate_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feedback_operacional"("p_candidate_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_gap_headcount"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_gap_headcount"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gap_headcount"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_adjustment_requests"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_adjustment_requests"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_adjustment_requests"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_dept"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_dept"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_dept"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_development"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_development"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_development"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_documents"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_documents"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_documents"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_gorjetas"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_gorjetas"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_gorjetas"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_home"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_home"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_home"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_hour_bank"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_hour_bank"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_hour_bank"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_last_punch"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_last_punch"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_last_punch"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_payments"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_payments"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_payments"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_payslips"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_payslips"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_payslips"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_punch_history"("p_employee_id" "uuid", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_punch_history"("p_employee_id" "uuid", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_punch_history"("p_employee_id" "uuid", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_punches_today"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_punches_today"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_punches_today"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_registro"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_registro"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_registro"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_sector"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_sector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_sector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_tier"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_tier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_tier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_tier_real"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_tier_real"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_tier_real"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_unit"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_unit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_unit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_vacations"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_vacations"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_vacations"("p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organograma"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_organograma"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organograma"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_produto_meses"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_produto_meses"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_produto_meses"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_punches_by_unit"("p_unit_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_punches_by_unit"("p_unit_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_punches_by_unit"("p_unit_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_quadro_completo"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_quadro_completo"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_quadro_completo"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_quadro_ideal"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_quadro_ideal"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_quadro_ideal"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_survey_results"("p_survey_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_survey_results"("p_survey_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_survey_results"("p_survey_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unit_geofence"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unit_geofence"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unit_geofence"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unit_surveys"("p_unit_id" "uuid", "p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unit_surveys"("p_unit_id" "uuid", "p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unit_surveys"("p_unit_id" "uuid", "p_employee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."importar_folha_empresa"("p_linhas" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."importar_folha_empresa"("p_linhas" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."importar_folha_empresa"("p_linhas" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_document"("p_employee_id" "uuid", "p_unit_id" "uuid", "p_name" "text", "p_type" "text", "p_storage_path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_document"("p_employee_id" "uuid", "p_unit_id" "uuid", "p_name" "text", "p_type" "text", "p_storage_path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_document"("p_employee_id" "uuid", "p_unit_id" "uuid", "p_name" "text", "p_type" "text", "p_storage_path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text", "p_aprovado" boolean, "p_distance_meters" integer, "p_gps_failed" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text", "p_aprovado" boolean, "p_distance_meters" integer, "p_gps_failed" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_punch"("p_employee_id" "uuid", "p_tipo" "text", "p_timestamp" timestamp with time zone, "p_latitude" double precision, "p_longitude" double precision, "p_device_info" "text", "p_aprovado" boolean, "p_distance_meters" integer, "p_gps_failed" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_accessible_unit_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."kph_accessible_unit_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_accessible_unit_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_can_delete_event_brand"("p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kph_can_delete_event_brand"("p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_can_delete_event_brand"("p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_can_write_event_brand"("p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kph_can_write_event_brand"("p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_can_write_event_brand"("p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_has_role_for_brand"("p_brand_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_brand"("p_brand_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_brand"("p_brand_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_has_role_for_group"("p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_group"("p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_group"("p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_has_role_for_unit"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_unit"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_has_role_for_unit"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_is_founder"() TO "anon";
GRANT ALL ON FUNCTION "public"."kph_is_founder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_is_founder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kph_is_founder_or_cfo"() TO "anon";
GRANT ALL ON FUNCTION "public"."kph_is_founder_or_cfo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kph_is_founder_or_cfo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."maza_is_founder"() TO "anon";
GRANT ALL ON FUNCTION "public"."maza_is_founder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maza_is_founder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."norm_fone_br"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."norm_fone_br"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."norm_fone_br"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payroll_cc_fopag"("p_departamento" "text", "p_cargo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payroll_competencia_mes_ano"("p_competencia" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."payroll_interval_to_decimal_br"("v" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."payroll_num_to_br"("v" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."payroll_num_to_br"("v" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."payroll_num_to_br"("v" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."payroll_parse_hhmm"("v" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."payroll_parse_hhmm"("v" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payroll_parse_hhmm"("v" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalc_purchase_order_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_purchase_order_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_purchase_order_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_punch_adjustment"("p_request_id" "uuid", "p_aprovado_por" "uuid", "p_status" "text", "p_inserir_punches" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_punch_adjustment"("p_request_id" "uuid", "p_aprovado_por" "uuid", "p_status" "text", "p_inserir_punches" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_punch_adjustment"("p_request_id" "uuid", "p_aprovado_por" "uuid", "p_status" "text", "p_inserir_punches" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_coletar_periodo"("p_unit_id" "uuid", "p_competencia" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_coletar_periodo"("p_unit_id" "uuid", "p_competencia" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_coletar_periodo"("p_unit_id" "uuid", "p_competencia" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_espelho_fopag"("p_periodo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_gerar_txt_dominio"("p_periodo_id" "uuid", "p_cod_empresa" "text", "p_tipo_registro" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_gerar_txt_dominio"("p_periodo_id" "uuid", "p_cod_empresa" "text", "p_tipo_registro" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_gerar_txt_dominio"("p_periodo_id" "uuid", "p_cod_empresa" "text", "p_tipo_registro" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_fechamento"("p_periodo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_fechamento"("p_periodo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_fechamento"("p_periodo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_periodos"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_periodos"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_listar_periodos"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_txt_pendencias"("p_periodo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_txt_pendencias"("p_periodo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_txt_pendencias"("p_periodo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_payroll_upsert_lancamento_manual"("p_periodo_id" "uuid", "p_employee_id" "uuid", "p_cod_kph" "text", "p_valor" numeric, "p_valor_horas" "text", "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_payroll_upsert_lancamento_manual"("p_periodo_id" "uuid", "p_employee_id" "uuid", "p_cod_kph" "text", "p_valor" numeric, "p_valor_horas" "text", "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_payroll_upsert_lancamento_manual"("p_periodo_id" "uuid", "p_employee_id" "uuid", "p_cod_kph" "text", "p_valor" numeric, "p_valor_horas" "text", "p_observacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_responses" json) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_responses" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_responses" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_employee_id" "uuid", "p_survey_id" "uuid", "p_responses" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_employee_id" "uuid", "p_survey_id" "uuid", "p_responses" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_survey_responses"("p_employee_id" "uuid", "p_survey_id" "uuid", "p_responses" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_employee_photo"("p_employee_id" "uuid", "p_photo_url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_employee_photo"("p_employee_id" "uuid", "p_photo_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_employee_photo"("p_employee_id" "uuid", "p_photo_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_avaliacao"("p_candidate_id" "uuid", "p_aderencia" numeric, "p_experiencia" numeric, "p_tec" numeric, "p_comp" numeric, "p_aderencia_ia" boolean, "p_experiencia_ia" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_avaliacao"("p_candidate_id" "uuid", "p_aderencia" numeric, "p_experiencia" numeric, "p_tec" numeric, "p_comp" numeric, "p_aderencia_ia" boolean, "p_experiencia_ia" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_avaliacao"("p_candidate_id" "uuid", "p_aderencia" numeric, "p_experiencia" numeric, "p_tec" numeric, "p_comp" numeric, "p_aderencia_ia" boolean, "p_experiencia_ia" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."cargo_salarios" TO "anon";
GRANT ALL ON TABLE "public"."cargo_salarios" TO "authenticated";
GRANT ALL ON TABLE "public"."cargo_salarios" TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_cargo_salario"("p_id" "uuid", "p_salario_min" numeric, "p_salario_ref" numeric, "p_salario_max" numeric, "p_observacao" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_cargo_salario"("p_id" "uuid", "p_salario_min" numeric, "p_salario_ref" numeric, "p_salario_max" numeric, "p_observacao" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_cargo_salario"("p_id" "uuid", "p_salario_min" numeric, "p_salario_ref" numeric, "p_salario_max" numeric, "p_observacao" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text", "p_avaliador_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text", "p_avaliador_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_feedback_operacional"("p_candidate_id" "uuid", "p_agendamento_id" "uuid", "p_postura" numeric, "p_ritmo" numeric, "p_dominio" numeric, "p_higiene" numeric, "p_equipe" numeric, "p_parecer" "text", "p_avaliador_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_employee_id" "uuid", "p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_employee_id" "uuid", "p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_push_token"("p_employee_id" "uuid", "p_token" "text") TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_action_plans" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_action_plans" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_action_plans" TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_execution_topicos" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_execution_topicos" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_execution_topicos" TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_executions" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_executions" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_executions" TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_responses" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_responses" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_responses" TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_template_items" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_template_items" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_template_items" TO "service_role";



GRANT ALL ON TABLE "mise"."checklist_templates" TO "anon";
GRANT ALL ON TABLE "mise"."checklist_templates" TO "authenticated";
GRANT ALL ON TABLE "mise"."checklist_templates" TO "service_role";



GRANT ALL ON TABLE "mise"."crivo_locais" TO "anon";
GRANT ALL ON TABLE "mise"."crivo_locais" TO "authenticated";
GRANT ALL ON TABLE "mise"."crivo_locais" TO "service_role";



GRANT ALL ON TABLE "mise"."debug_responder" TO "anon";
GRANT ALL ON TABLE "mise"."debug_responder" TO "authenticated";
GRANT ALL ON TABLE "mise"."debug_responder" TO "service_role";



GRANT ALL ON TABLE "mise"."ingredient_shelf_life" TO "anon";
GRANT ALL ON TABLE "mise"."ingredient_shelf_life" TO "authenticated";
GRANT ALL ON TABLE "mise"."ingredient_shelf_life" TO "service_role";



GRANT ALL ON TABLE "mise"."inventory_count_items" TO "anon";
GRANT ALL ON TABLE "mise"."inventory_count_items" TO "authenticated";
GRANT ALL ON TABLE "mise"."inventory_count_items" TO "service_role";



GRANT ALL ON TABLE "mise"."inventory_counts" TO "anon";
GRANT ALL ON TABLE "mise"."inventory_counts" TO "authenticated";
GRANT ALL ON TABLE "mise"."inventory_counts" TO "service_role";



GRANT ALL ON TABLE "mise"."labels" TO "anon";
GRANT ALL ON TABLE "mise"."labels" TO "authenticated";
GRANT ALL ON TABLE "mise"."labels" TO "service_role";



GRANT ALL ON TABLE "mise"."print_points" TO "anon";
GRANT ALL ON TABLE "mise"."print_points" TO "authenticated";
GRANT ALL ON TABLE "mise"."print_points" TO "service_role";



GRANT ALL ON TABLE "mise"."production_orders" TO "anon";
GRANT ALL ON TABLE "mise"."production_orders" TO "authenticated";
GRANT ALL ON TABLE "mise"."production_orders" TO "service_role";



GRANT ALL ON TABLE "mise"."receiving_items" TO "anon";
GRANT ALL ON TABLE "mise"."receiving_items" TO "authenticated";
GRANT ALL ON TABLE "mise"."receiving_items" TO "service_role";



GRANT ALL ON TABLE "mise"."receiving_records" TO "anon";
GRANT ALL ON TABLE "mise"."receiving_records" TO "authenticated";
GRANT ALL ON TABLE "mise"."receiving_records" TO "service_role";



GRANT ALL ON TABLE "mise"."responsaveis" TO "anon";
GRANT ALL ON TABLE "mise"."responsaveis" TO "authenticated";
GRANT ALL ON TABLE "mise"."responsaveis" TO "service_role";



GRANT ALL ON TABLE "mise"."responsavel_unidades" TO "anon";
GRANT ALL ON TABLE "mise"."responsavel_unidades" TO "authenticated";
GRANT ALL ON TABLE "mise"."responsavel_unidades" TO "service_role";



GRANT ALL ON TABLE "mise"."sessions" TO "anon";
GRANT ALL ON TABLE "mise"."sessions" TO "authenticated";
GRANT ALL ON TABLE "mise"."sessions" TO "service_role";



GRANT ALL ON TABLE "mise"."shelf_life_rules" TO "anon";
GRANT ALL ON TABLE "mise"."shelf_life_rules" TO "authenticated";
GRANT ALL ON TABLE "mise"."shelf_life_rules" TO "service_role";



GRANT ALL ON TABLE "mise"."user_pins" TO "anon";
GRANT ALL ON TABLE "mise"."user_pins" TO "authenticated";
GRANT ALL ON TABLE "mise"."user_pins" TO "service_role";



GRANT ALL ON TABLE "mise"."waste_records" TO "anon";
GRANT ALL ON TABLE "mise"."waste_records" TO "authenticated";
GRANT ALL ON TABLE "mise"."waste_records" TO "service_role";



GRANT ALL ON TABLE "public"."Comments" TO "anon";
GRANT ALL ON TABLE "public"."Comments" TO "authenticated";
GRANT ALL ON TABLE "public"."Comments" TO "service_role";



GRANT ALL ON TABLE "public"."Projects" TO "anon";
GRANT ALL ON TABLE "public"."Projects" TO "authenticated";
GRANT ALL ON TABLE "public"."Projects" TO "service_role";



GRANT ALL ON TABLE "public"."Task_Assignees" TO "anon";
GRANT ALL ON TABLE "public"."Task_Assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."Task_Assignees" TO "service_role";



GRANT ALL ON TABLE "public"."Tasks" TO "anon";
GRANT ALL ON TABLE "public"."Tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."Tasks" TO "service_role";



GRANT ALL ON TABLE "public"."Team_Members" TO "anon";
GRANT ALL ON TABLE "public"."Team_Members" TO "authenticated";
GRANT ALL ON TABLE "public"."Team_Members" TO "service_role";



GRANT ALL ON TABLE "public"."absences" TO "anon";
GRANT ALL ON TABLE "public"."absences" TO "authenticated";
GRANT ALL ON TABLE "public"."absences" TO "service_role";



GRANT ALL ON TABLE "public"."access_requests" TO "anon";
GRANT ALL ON TABLE "public"."access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."action_plan_tasks" TO "anon";
GRANT ALL ON TABLE "public"."action_plan_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."action_plan_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."action_plans" TO "anon";
GRANT ALL ON TABLE "public"."action_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."action_plans" TO "service_role";



GRANT ALL ON TABLE "public"."agent_conversations" TO "anon";
GRANT ALL ON TABLE "public"."agent_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."agent_metrics" TO "anon";
GRANT ALL ON TABLE "public"."agent_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."agent_prompt_versions" TO "anon";
GRANT ALL ON TABLE "public"."agent_prompt_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_prompt_versions" TO "service_role";



GRANT ALL ON TABLE "public"."agent_runs" TO "anon";
GRANT ALL ON TABLE "public"."agent_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_runs" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_summaries" TO "anon";
GRANT ALL ON TABLE "public"."attendance_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_nutricional" TO "anon";
GRANT ALL ON TABLE "public"."auditoria_nutricional" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria_nutricional" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auditoria_nutricional_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auditoria_nutricional_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auditoria_nutricional_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."auth_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacao_ciclos" TO "anon";
GRANT ALL ON TABLE "public"."avaliacao_ciclos" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacao_ciclos" TO "service_role";



GRANT ALL ON TABLE "public"."avaliacao_participantes" TO "anon";
GRANT ALL ON TABLE "public"."avaliacao_participantes" TO "authenticated";
GRANT ALL ON TABLE "public"."avaliacao_participantes" TO "service_role";



GRANT ALL ON TABLE "public"."brand_links" TO "anon";
GRANT ALL ON TABLE "public"."brand_links" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_links" TO "service_role";



GRANT ALL ON TABLE "public"."brand_targets" TO "anon";
GRANT ALL ON TABLE "public"."brand_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."brand_targets" TO "service_role";



GRANT ALL ON TABLE "public"."brands" TO "anon";
GRANT ALL ON TABLE "public"."brands" TO "authenticated";
GRANT ALL ON TABLE "public"."brands" TO "service_role";



GRANT ALL ON TABLE "public"."buckets" TO "anon";
GRANT ALL ON TABLE "public"."buckets" TO "authenticated";
GRANT ALL ON TABLE "public"."buckets" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_agendamentos" TO "anon";
GRANT ALL ON TABLE "public"."candidate_agendamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_agendamentos" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_pipeline" TO "anon";
GRANT ALL ON TABLE "public"."candidate_pipeline" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_pipeline" TO "service_role";



GRANT ALL ON TABLE "public"."candidates" TO "anon";
GRANT ALL ON TABLE "public"."candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."candidates" TO "service_role";



GRANT ALL ON TABLE "public"."candidatos_maya" TO "anon";
GRANT ALL ON TABLE "public"."candidatos_maya" TO "authenticated";
GRANT ALL ON TABLE "public"."candidatos_maya" TO "service_role";



GRANT ALL ON TABLE "public"."cargo_grupos" TO "anon";
GRANT ALL ON TABLE "public"."cargo_grupos" TO "authenticated";
GRANT ALL ON TABLE "public"."cargo_grupos" TO "service_role";



GRANT ALL ON TABLE "public"."cargos" TO "anon";
GRANT ALL ON TABLE "public"."cargos" TO "authenticated";
GRANT ALL ON TABLE "public"."cargos" TO "service_role";



GRANT ALL ON TABLE "public"."cct_versions" TO "anon";
GRANT ALL ON TABLE "public"."cct_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."cct_versions" TO "service_role";



GRANT ALL ON TABLE "public"."checklist_records" TO "anon";
GRANT ALL ON TABLE "public"."checklist_records" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_records" TO "service_role";



GRANT ALL ON TABLE "public"."client_interactions" TO "anon";
GRANT ALL ON TABLE "public"."client_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."client_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."climate_questions" TO "anon";
GRANT ALL ON TABLE "public"."climate_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_questions" TO "service_role";



GRANT ALL ON TABLE "public"."climate_responses" TO "anon";
GRANT ALL ON TABLE "public"."climate_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_responses" TO "service_role";



GRANT ALL ON TABLE "public"."climate_survey_questions" TO "anon";
GRANT ALL ON TABLE "public"."climate_survey_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_survey_questions" TO "service_role";



GRANT ALL ON TABLE "public"."climate_survey_responses" TO "anon";
GRANT ALL ON TABLE "public"."climate_survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_survey_responses" TO "service_role";



GRANT ALL ON TABLE "public"."climate_surveys" TO "anon";
GRANT ALL ON TABLE "public"."climate_surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_surveys" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."conferencias" TO "authenticated";
GRANT ALL ON TABLE "public"."conferencias" TO "service_role";



GRANT ALL ON TABLE "public"."contas_bancarias" TO "authenticated";
GRANT ALL ON TABLE "public"."contas_bancarias" TO "service_role";



GRANT ALL ON TABLE "public"."contatos_kph" TO "anon";
GRANT ALL ON TABLE "public"."contatos_kph" TO "authenticated";
GRANT ALL ON TABLE "public"."contatos_kph" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_payments" TO "anon";
GRANT ALL ON TABLE "public"."contractor_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_payments" TO "service_role";



GRANT ALL ON TABLE "public"."contractor_vacations" TO "anon";
GRANT ALL ON TABLE "public"."contractor_vacations" TO "authenticated";
GRANT ALL ON TABLE "public"."contractor_vacations" TO "service_role";



GRANT ALL ON TABLE "public"."contractors" TO "anon";
GRANT ALL ON TABLE "public"."contractors" TO "authenticated";
GRANT ALL ON TABLE "public"."contractors" TO "service_role";



GRANT ALL ON TABLE "public"."contratos" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos" TO "service_role";



GRANT ALL ON TABLE "public"."contratos_arquivos" TO "authenticated";
GRANT ALL ON TABLE "public"."contratos_arquivos" TO "service_role";



GRANT ALL ON TABLE "public"."dependents" TO "anon";
GRANT ALL ON TABLE "public"."dependents" TO "authenticated";
GRANT ALL ON TABLE "public"."dependents" TO "service_role";



GRANT ALL ON TABLE "public"."dho_tracking" TO "anon";
GRANT ALL ON TABLE "public"."dho_tracking" TO "authenticated";
GRANT ALL ON TABLE "public"."dho_tracking" TO "service_role";



GRANT ALL ON TABLE "public"."disc_profiles" TO "anon";
GRANT ALL ON TABLE "public"."disc_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."disc_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."disciplinary_actions" TO "anon";
GRANT ALL ON TABLE "public"."disciplinary_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."disciplinary_actions" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."dre_contratos_fixos" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_contratos_fixos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_contratos_fixos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_contratos_fixos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_contratos_fixos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_despesa_detalhada" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_despesa_detalhada" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_despesa_detalhada_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_despesa_detalhada_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_despesa_detalhada_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_faturamento_historico" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_faturamento_historico" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_faturamento_historico_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_faturamento_historico_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_faturamento_historico_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_folha" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_folha" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_folha_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_folha_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_folha_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_gorjeta_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_gorjeta_mensal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_gorjeta_mensal_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_gorjeta_mensal_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_gorjeta_mensal_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_indicadores" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_indicadores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_indicadores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_indicadores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_indicadores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_kpis_mensais" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_kpis_mensais" TO "service_role";



GRANT ALL ON TABLE "public"."dre_linhas_detalhadas" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_linhas_detalhadas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_linhas_detalhadas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_linhas_detalhadas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_linhas_detalhadas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_manutencao_detalhada" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_manutencao_detalhada" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_manutencao_detalhada_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_manutencao_detalhada_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_manutencao_detalhada_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_mensal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_mensal_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_mensal_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_mensal_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_pessoal_detalhado" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_pessoal_detalhado" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_pessoal_detalhado_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_pessoal_detalhado_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_pessoal_detalhado_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_prestadores" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_prestadores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_prestadores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_prestadores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_prestadores_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_receita_detalhada" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_receita_detalhada" TO "service_role";



GRANT ALL ON SEQUENCE "public"."dre_receita_detalhada_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."dre_receita_detalhada_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."dre_receita_detalhada_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."dre_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."dre_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."employee_auth" TO "anon";
GRANT ALL ON TABLE "public"."employee_auth" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_auth" TO "service_role";



GRANT ALL ON TABLE "public"."employee_availability" TO "anon";
GRANT ALL ON TABLE "public"."employee_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_availability" TO "service_role";



GRANT ALL ON TABLE "public"."employee_benefits" TO "anon";
GRANT ALL ON TABLE "public"."employee_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."employee_codigos_dominio" TO "anon";
GRANT ALL ON TABLE "public"."employee_codigos_dominio" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_codigos_dominio" TO "service_role";



GRANT ALL ON TABLE "public"."employee_documents" TO "anon";
GRANT ALL ON TABLE "public"."employee_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_documents" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."event_attachments" TO "anon";
GRANT ALL ON TABLE "public"."event_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."event_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."event_infra_items" TO "anon";
GRANT ALL ON TABLE "public"."event_infra_items" TO "authenticated";
GRANT ALL ON TABLE "public"."event_infra_items" TO "service_role";



GRANT ALL ON TABLE "public"."event_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."event_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."event_menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."event_staff" TO "anon";
GRANT ALL ON TABLE "public"."event_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."event_staff" TO "service_role";



GRANT ALL ON TABLE "public"."event_status_log" TO "anon";
GRANT ALL ON TABLE "public"."event_status_log" TO "authenticated";
GRANT ALL ON TABLE "public"."event_status_log" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."feedbacks" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_importacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_importacoes" TO "service_role";



GRANT ALL ON TABLE "public"."financeiro_revisoes" TO "anon";
GRANT ALL ON TABLE "public"."financeiro_revisoes" TO "authenticated";
GRANT ALL ON TABLE "public"."financeiro_revisoes" TO "service_role";



GRANT ALL ON TABLE "public"."folha_empresa" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."folha_empresa" TO "authenticated";



GRANT ALL ON TABLE "public"."fornecedores" TO "authenticated";
GRANT ALL ON TABLE "public"."fornecedores" TO "service_role";



GRANT ALL ON TABLE "public"."fornecedores_depara" TO "authenticated";
GRANT ALL ON TABLE "public"."fornecedores_depara" TO "service_role";



GRANT ALL ON TABLE "public"."gorjeta_cargo_pontos" TO "anon";
GRANT ALL ON TABLE "public"."gorjeta_cargo_pontos" TO "authenticated";
GRANT ALL ON TABLE "public"."gorjeta_cargo_pontos" TO "service_role";



GRANT ALL ON TABLE "public"."gorjeta_dias" TO "anon";
GRANT ALL ON TABLE "public"."gorjeta_dias" TO "authenticated";
GRANT ALL ON TABLE "public"."gorjeta_dias" TO "service_role";



GRANT ALL ON TABLE "public"."gorjeta_distribuicao" TO "anon";
GRANT ALL ON TABLE "public"."gorjeta_distribuicao" TO "authenticated";
GRANT ALL ON TABLE "public"."gorjeta_distribuicao" TO "service_role";



GRANT ALL ON TABLE "public"."gorjeta_periodos" TO "anon";
GRANT ALL ON TABLE "public"."gorjeta_periodos" TO "authenticated";
GRANT ALL ON TABLE "public"."gorjeta_periodos" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."hos_approvals" TO "anon";
GRANT ALL ON TABLE "public"."hos_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."hos_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."hos_insights" TO "anon";
GRANT ALL ON TABLE "public"."hos_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."hos_insights" TO "service_role";



GRANT ALL ON TABLE "public"."hos_jobs" TO "anon";
GRANT ALL ON TABLE "public"."hos_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."hos_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."hos_runs" TO "anon";
GRANT ALL ON TABLE "public"."hos_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."hos_runs" TO "service_role";



GRANT ALL ON TABLE "public"."hour_bank" TO "anon";
GRANT ALL ON TABLE "public"."hour_bank" TO "authenticated";
GRANT ALL ON TABLE "public"."hour_bank" TO "service_role";



GRANT ALL ON TABLE "public"."hr_policies" TO "anon";
GRANT ALL ON TABLE "public"."hr_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."hr_policies" TO "service_role";



GRANT ALL ON TABLE "public"."import_logs" TO "anon";
GRANT ALL ON TABLE "public"."import_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_logs" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_price_history" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_stock" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_stock" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."interview_questions" TO "anon";
GRANT ALL ON TABLE "public"."interview_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_questions" TO "service_role";



GRANT ALL ON TABLE "public"."interview_responses" TO "anon";
GRANT ALL ON TABLE "public"."interview_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_responses" TO "service_role";



GRANT ALL ON TABLE "public"."interviews" TO "anon";
GRANT ALL ON TABLE "public"."interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."interviews" TO "service_role";



GRANT ALL ON TABLE "public"."job_descriptions" TO "anon";
GRANT ALL ON TABLE "public"."job_descriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."job_descriptions" TO "service_role";



GRANT ALL ON TABLE "public"."job_opening_logs" TO "anon";
GRANT ALL ON TABLE "public"."job_opening_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_opening_logs" TO "service_role";



GRANT ALL ON TABLE "public"."job_openings" TO "anon";
GRANT ALL ON TABLE "public"."job_openings" TO "authenticated";
GRANT ALL ON TABLE "public"."job_openings" TO "service_role";



GRANT ALL ON TABLE "public"."job_requisitions" TO "anon";
GRANT ALL ON TABLE "public"."job_requisitions" TO "authenticated";
GRANT ALL ON TABLE "public"."job_requisitions" TO "service_role";



GRANT ALL ON TABLE "public"."kph_alerts" TO "anon";
GRANT ALL ON TABLE "public"."kph_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."kph_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."kph_insights" TO "anon";
GRANT ALL ON TABLE "public"."kph_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."kph_insights" TO "service_role";



GRANT ALL ON TABLE "public"."kph_intelligence_scores" TO "anon";
GRANT ALL ON TABLE "public"."kph_intelligence_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."kph_intelligence_scores" TO "service_role";



GRANT ALL ON TABLE "public"."kph_learning_proposals" TO "anon";
GRANT ALL ON TABLE "public"."kph_learning_proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."kph_learning_proposals" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."lancamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."lancamentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lancamentos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lancamentos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lancamentos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."learning_machine_reports" TO "anon";
GRANT ALL ON TABLE "public"."learning_machine_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_machine_reports" TO "service_role";



GRANT ALL ON TABLE "public"."receita_cancelamentos_detalhe" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_cancelamentos_detalhe" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lorean_cancelamentos_detalhe_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lorean_cancelamentos_detalhe_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lorean_cancelamentos_detalhe_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receita_descontos_detalhe" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_descontos_detalhe" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lorean_descontos_detalhe_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lorean_descontos_detalhe_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lorean_descontos_detalhe_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receita_produtos_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_produtos_dia" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lorean_produtos_dia_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lorean_produtos_dia_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lorean_produtos_dia_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."manutencao_aprovacoes" TO "anon";
GRANT ALL ON TABLE "public"."manutencao_aprovacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."manutencao_aprovacoes" TO "service_role";



GRANT ALL ON TABLE "public"."manutencao_chamados" TO "anon";
GRANT ALL ON TABLE "public"."manutencao_chamados" TO "authenticated";
GRANT ALL ON TABLE "public"."manutencao_chamados" TO "service_role";



GRANT ALL ON TABLE "public"."manutencao_parcelas" TO "anon";
GRANT ALL ON TABLE "public"."manutencao_parcelas" TO "authenticated";
GRANT ALL ON TABLE "public"."manutencao_parcelas" TO "service_role";



GRANT ALL ON TABLE "public"."mapa_conta_dre" TO "authenticated";
GRANT ALL ON TABLE "public"."mapa_conta_dre" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."metas" TO "authenticated";
GRANT ALL ON TABLE "public"."metas" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."metas_dia_override" TO "authenticated";
GRANT ALL ON TABLE "public"."metas_dia_override" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metas_dia_override_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metas_dia_override_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metas_dia_override_id_seq" TO "service_role";



GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."metas_dia_semana" TO "authenticated";
GRANT ALL ON TABLE "public"."metas_dia_semana" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metas_dia_semana_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metas_dia_semana_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metas_dia_semana_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."metas_projecoes" TO "anon";
GRANT ALL ON TABLE "public"."metas_projecoes" TO "authenticated";
GRANT ALL ON TABLE "public"."metas_projecoes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."metas_projecoes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."metas_projecoes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."metas_projecoes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes_caixa" TO "service_role";



GRANT ALL ON SEQUENCE "public"."movimentacoes_caixa_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."movimentacoes_caixa_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."movimentacoes_caixa_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movimentacoes_rh" TO "anon";
GRANT ALL ON TABLE "public"."movimentacoes_rh" TO "authenticated";
GRANT ALL ON TABLE "public"."movimentacoes_rh" TO "service_role";



GRANT ALL ON TABLE "public"."nfe_documentos" TO "authenticated";
GRANT ALL ON TABLE "public"."nfe_documentos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nfe_documentos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nfe_documentos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nfe_documentos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."nfe_importacoes" TO "authenticated";
GRANT ALL ON TABLE "public"."nfe_importacoes" TO "service_role";



GRANT ALL ON TABLE "public"."notas_detalhadas" TO "anon";
GRANT ALL ON TABLE "public"."notas_detalhadas" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_detalhadas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notas_detalhadas_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_detalhadas_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_detalhadas_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notas_nutri" TO "anon";
GRANT ALL ON TABLE "public"."notas_nutri" TO "authenticated";
GRANT ALL ON TABLE "public"."notas_nutri" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notas_nutri_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notas_nutri_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notas_nutri_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."occupational_health" TO "anon";
GRANT ALL ON TABLE "public"."occupational_health" TO "authenticated";
GRANT ALL ON TABLE "public"."occupational_health" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_checklist" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_runs" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_runs" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_tarefas" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_tarefas" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_tarefas" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_templates" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_templates" TO "service_role";



GRANT ALL ON TABLE "public"."origens_candidato" TO "anon";
GRANT ALL ON TABLE "public"."origens_candidato" TO "authenticated";
GRANT ALL ON TABLE "public"."origens_candidato" TO "service_role";



GRANT ALL ON TABLE "public"."orkestri_achados" TO "anon";
GRANT ALL ON TABLE "public"."orkestri_achados" TO "authenticated";
GRANT ALL ON TABLE "public"."orkestri_achados" TO "service_role";



GRANT ALL ON TABLE "public"."orkestri_leads" TO "anon";
GRANT ALL ON TABLE "public"."orkestri_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."orkestri_leads" TO "service_role";



GRANT ALL ON TABLE "public"."orquestrador_jobs" TO "anon";
GRANT ALL ON TABLE "public"."orquestrador_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."orquestrador_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."overtime_records" TO "anon";
GRANT ALL ON TABLE "public"."overtime_records" TO "authenticated";
GRANT ALL ON TABLE "public"."overtime_records" TO "service_role";



GRANT ALL ON TABLE "public"."page_views" TO "anon";
GRANT ALL ON TABLE "public"."page_views" TO "authenticated";
GRANT ALL ON TABLE "public"."page_views" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_dominio_cadastro" TO "anon";
GRANT ALL ON TABLE "public"."payroll_dominio_cadastro" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_dominio_cadastro" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_dominio_cargo" TO "anon";
GRANT ALL ON TABLE "public"."payroll_dominio_cargo" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_dominio_cargo" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_dominio_empresa" TO "anon";
GRANT ALL ON TABLE "public"."payroll_dominio_empresa" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_dominio_empresa" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_extrato_dominio_colaborador" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_extrato_dominio_colaborador" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_extrato_dominio_competencia" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_extrato_dominio_competencia" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_extrato_dominio_linha" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_extrato_dominio_linha" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_extrato_dominio_rubrica" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_extrato_dominio_rubrica" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_extrato_dominio_totais" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_extrato_dominio_totais" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_fechamento_linha" TO "anon";
GRANT ALL ON TABLE "public"."payroll_fechamento_linha" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_fechamento_linha" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_fechamento_periodo" TO "anon";
GRANT ALL ON TABLE "public"."payroll_fechamento_periodo" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_fechamento_periodo" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_rubricas" TO "anon";
GRANT ALL ON TABLE "public"."payroll_rubricas" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_rubricas" TO "service_role";



GRANT ALL ON TABLE "public"."payslips" TO "anon";
GRANT ALL ON TABLE "public"."payslips" TO "authenticated";
GRANT ALL ON TABLE "public"."payslips" TO "service_role";



GRANT ALL ON TABLE "public"."pdi_metas" TO "anon";
GRANT ALL ON TABLE "public"."pdi_metas" TO "authenticated";
GRANT ALL ON TABLE "public"."pdi_metas" TO "service_role";



GRANT ALL ON TABLE "public"."pdis" TO "anon";
GRANT ALL ON TABLE "public"."pdis" TO "authenticated";
GRANT ALL ON TABLE "public"."pdis" TO "service_role";



GRANT ALL ON TABLE "public"."performance_reviews" TO "anon";
GRANT ALL ON TABLE "public"."performance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."performance_templates" TO "anon";
GRANT ALL ON TABLE "public"."performance_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_templates" TO "service_role";



GRANT ALL ON TABLE "public"."plan_members" TO "anon";
GRANT ALL ON TABLE "public"."plan_members" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_members" TO "service_role";



GRANT ALL ON TABLE "public"."plano_contas" TO "authenticated";
GRANT ALL ON TABLE "public"."plano_contas" TO "service_role";



GRANT ALL ON TABLE "public"."ponto_mensal" TO "anon";
GRANT ALL ON TABLE "public"."ponto_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."ponto_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."price_quote_items" TO "anon";
GRANT ALL ON TABLE "public"."price_quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."price_quote_items" TO "service_role";



GRANT ALL ON TABLE "public"."price_quotes" TO "anon";
GRANT ALL ON TABLE "public"."price_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."price_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_depara" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_depara" TO "service_role";



GRANT ALL ON TABLE "public"."produtos_relatorio" TO "authenticated";
GRANT ALL ON TABLE "public"."produtos_relatorio" TO "service_role";



GRANT ALL ON SEQUENCE "public"."produtos_relatorio_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."produtos_relatorio_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."produtos_relatorio_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_invites" TO "anon";
GRANT ALL ON TABLE "public"."project_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."project_invites" TO "service_role";



GRANT ALL ON TABLE "public"."project_members" TO "anon";
GRANT ALL ON TABLE "public"."project_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_members" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."protestos_certidoes" TO "authenticated";
GRANT ALL ON TABLE "public"."protestos_certidoes" TO "service_role";



GRANT ALL ON TABLE "public"."protestos_registros" TO "authenticated";
GRANT ALL ON TABLE "public"."protestos_registros" TO "service_role";



GRANT ALL ON TABLE "public"."punch_adjustment_requests" TO "anon";
GRANT ALL ON TABLE "public"."punch_adjustment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."punch_adjustment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_invoices" TO "anon";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchase_orders_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchase_orders_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchase_orders_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."quadro_ideal" TO "anon";
GRANT ALL ON TABLE "public"."quadro_ideal" TO "authenticated";
GRANT ALL ON TABLE "public"."quadro_ideal" TO "service_role";



GRANT ALL ON TABLE "public"."quality_checklists" TO "anon";
GRANT ALL ON TABLE "public"."quality_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."quality_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."recebimento_itens" TO "anon";
GRANT ALL ON TABLE "public"."recebimento_itens" TO "authenticated";
GRANT ALL ON TABLE "public"."recebimento_itens" TO "service_role";



GRANT ALL ON TABLE "public"."recebimentos" TO "anon";
GRANT ALL ON TABLE "public"."recebimentos" TO "authenticated";
GRANT ALL ON TABLE "public"."recebimentos" TO "service_role";



GRANT ALL ON TABLE "public"."recebiveis_cartao" TO "authenticated";
GRANT ALL ON TABLE "public"."recebiveis_cartao" TO "service_role";



GRANT ALL ON SEQUENCE "public"."recebiveis_cartao_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recebiveis_cartao_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recebiveis_cartao_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."receita_ambientes" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_ambientes" TO "service_role";



GRANT ALL ON TABLE "public"."receita_caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_caixas" TO "service_role";



GRANT ALL ON TABLE "public"."receita_cancelamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_cancelamentos" TO "service_role";



GRANT ALL ON TABLE "public"."receita_descontos" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_descontos" TO "service_role";



GRANT ALL ON TABLE "public"."receita_dias" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_dias" TO "service_role";



GRANT ALL ON TABLE "public"."receita_grupos" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_grupos" TO "service_role";



GRANT ALL ON TABLE "public"."receita_horarios" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_horarios" TO "service_role";



GRANT ALL ON TABLE "public"."receita_import_log" TO "anon";
GRANT ALL ON TABLE "public"."receita_import_log" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_import_log" TO "service_role";



GRANT ALL ON TABLE "public"."receita_pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."receita_turnos" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_turnos" TO "service_role";



GRANT ALL ON TABLE "public"."receita_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."receita_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_items" TO "anon";
GRANT ALL ON TABLE "public"."recipe_items" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_items" TO "service_role";



GRANT ALL ON TABLE "public"."recipe_notes" TO "anon";
GRANT ALL ON TABLE "public"."recipe_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipe_notes" TO "service_role";



GRANT ALL ON TABLE "public"."reconciliacoes_sugeridas" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliacoes_sugeridas" TO "service_role";



GRANT ALL ON TABLE "public"."regras_classificacao" TO "authenticated";
GRANT ALL ON TABLE "public"."regras_classificacao" TO "service_role";



GRANT ALL ON TABLE "public"."relatorio_produtos" TO "anon";
GRANT ALL ON TABLE "public"."relatorio_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."relatorio_produtos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."relatorio_produtos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."relatorio_produtos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."relatorio_produtos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."reuniao_action_items" TO "anon";
GRANT ALL ON TABLE "public"."reuniao_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."reuniao_action_items" TO "service_role";



GRANT ALL ON TABLE "public"."reunioes_1on1" TO "anon";
GRANT ALL ON TABLE "public"."reunioes_1on1" TO "authenticated";
GRANT ALL ON TABLE "public"."reunioes_1on1" TO "service_role";



GRANT ALL ON TABLE "public"."roadmap_items" TO "anon";
GRANT ALL ON TABLE "public"."roadmap_items" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmap_items" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."score_events" TO "anon";
GRANT ALL ON TABLE "public"."score_events" TO "authenticated";
GRANT ALL ON TABLE "public"."score_events" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."sick_leaves" TO "anon";
GRANT ALL ON TABLE "public"."sick_leaves" TO "authenticated";
GRANT ALL ON TABLE "public"."sick_leaves" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."target_notes" TO "anon";
GRANT ALL ON TABLE "public"."target_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."target_notes" TO "service_role";



GRANT ALL ON TABLE "public"."task_assignees" TO "anon";
GRANT ALL ON TABLE "public"."task_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."terminations" TO "anon";
GRANT ALL ON TABLE "public"."terminations" TO "authenticated";
GRANT ALL ON TABLE "public"."terminations" TO "service_role";



GRANT ALL ON TABLE "public"."theo_tickets" TO "anon";
GRANT ALL ON TABLE "public"."theo_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."theo_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."time_bank_balance" TO "anon";
GRANT ALL ON TABLE "public"."time_bank_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."time_bank_balance" TO "service_role";



GRANT ALL ON TABLE "public"."time_clock_punches" TO "anon";
GRANT ALL ON TABLE "public"."time_clock_punches" TO "authenticated";
GRANT ALL ON TABLE "public"."time_clock_punches" TO "service_role";



GRANT ALL ON TABLE "public"."time_records" TO "anon";
GRANT ALL ON TABLE "public"."time_records" TO "authenticated";
GRANT ALL ON TABLE "public"."time_records" TO "service_role";



GRANT ALL ON TABLE "public"."tips_records" TO "anon";
GRANT ALL ON TABLE "public"."tips_records" TO "authenticated";
GRANT ALL ON TABLE "public"."tips_records" TO "service_role";



GRANT ALL ON TABLE "public"."titulo_override" TO "authenticated";
GRANT ALL ON TABLE "public"."titulo_override" TO "service_role";



GRANT ALL ON TABLE "public"."titulo_pagamentos" TO "anon";
GRANT ALL ON TABLE "public"."titulo_pagamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."titulo_pagamentos" TO "service_role";



GRANT ALL ON TABLE "public"."titulos_a_pagar" TO "authenticated";
GRANT ALL ON TABLE "public"."titulos_a_pagar" TO "service_role";



GRANT ALL ON TABLE "public"."training_participants" TO "anon";
GRANT ALL ON TABLE "public"."training_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."training_participants" TO "service_role";



GRANT ALL ON TABLE "public"."training_records" TO "anon";
GRANT ALL ON TABLE "public"."training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."training_records" TO "service_role";



GRANT ALL ON TABLE "public"."training_templates" TO "anon";
GRANT ALL ON TABLE "public"."training_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."training_templates" TO "service_role";



GRANT ALL ON TABLE "public"."trainings" TO "anon";
GRANT ALL ON TABLE "public"."trainings" TO "authenticated";
GRANT ALL ON TABLE "public"."trainings" TO "service_role";



GRANT ALL ON TABLE "public"."transport_vouchers" TO "anon";
GRANT ALL ON TABLE "public"."transport_vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."transport_vouchers" TO "service_role";



GRANT ALL ON TABLE "public"."uniforms" TO "anon";
GRANT ALL ON TABLE "public"."uniforms" TO "authenticated";
GRANT ALL ON TABLE "public"."uniforms" TO "service_role";



GRANT ALL ON TABLE "public"."unit_cnpjs" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_cnpjs" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."v_alertas" TO "anon";
GRANT ALL ON TABLE "public"."v_alertas" TO "authenticated";
GRANT ALL ON TABLE "public"."v_alertas" TO "service_role";



GRANT ALL ON TABLE "public"."v_aprovacoes_pendentes" TO "anon";
GRANT ALL ON TABLE "public"."v_aprovacoes_pendentes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_aprovacoes_pendentes" TO "service_role";



GRANT ALL ON TABLE "public"."v_cadastro_saude" TO "anon";
GRANT ALL ON TABLE "public"."v_cadastro_saude" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cadastro_saude" TO "service_role";



GRANT ALL ON TABLE "public"."v_cmv_produto" TO "anon";
GRANT ALL ON TABLE "public"."v_cmv_produto" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cmv_produto" TO "service_role";



GRANT ALL ON TABLE "public"."v_despesa_canonica" TO "anon";
GRANT ALL ON TABLE "public"."v_despesa_canonica" TO "authenticated";
GRANT ALL ON TABLE "public"."v_despesa_canonica" TO "service_role";



GRANT ALL ON TABLE "public"."v_dre_canonico" TO "anon";
GRANT ALL ON TABLE "public"."v_dre_canonico" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dre_canonico" TO "service_role";



GRANT ALL ON TABLE "public"."v_dre_consolidado" TO "anon";
GRANT ALL ON TABLE "public"."v_dre_consolidado" TO "authenticated";
GRANT ALL ON TABLE "public"."v_dre_consolidado" TO "service_role";



GRANT ALL ON TABLE "public"."v_eventos_kpi" TO "anon";
GRANT ALL ON TABLE "public"."v_eventos_kpi" TO "authenticated";
GRANT ALL ON TABLE "public"."v_eventos_kpi" TO "service_role";



GRANT ALL ON TABLE "public"."v_fonte_saude" TO "anon";
GRANT ALL ON TABLE "public"."v_fonte_saude" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fonte_saude" TO "service_role";



GRANT ALL ON TABLE "public"."v_gorjeta_periodo_dia" TO "anon";
GRANT ALL ON TABLE "public"."v_gorjeta_periodo_dia" TO "authenticated";
GRANT ALL ON TABLE "public"."v_gorjeta_periodo_dia" TO "service_role";



GRANT ALL ON TABLE "public"."v_gorjeta_saude" TO "anon";
GRANT ALL ON TABLE "public"."v_gorjeta_saude" TO "authenticated";
GRANT ALL ON TABLE "public"."v_gorjeta_saude" TO "service_role";



GRANT ALL ON TABLE "public"."v_headcount_por_marca" TO "anon";
GRANT ALL ON TABLE "public"."v_headcount_por_marca" TO "authenticated";
GRANT ALL ON TABLE "public"."v_headcount_por_marca" TO "service_role";



GRANT ALL ON TABLE "public"."v_proximos_eventos" TO "anon";
GRANT ALL ON TABLE "public"."v_proximos_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."v_proximos_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."v_receita_canonico" TO "anon";
GRANT ALL ON TABLE "public"."v_receita_canonico" TO "authenticated";
GRANT ALL ON TABLE "public"."v_receita_canonico" TO "service_role";



GRANT ALL ON TABLE "public"."v_recrutamento_saude" TO "anon";
GRANT ALL ON TABLE "public"."v_recrutamento_saude" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recrutamento_saude" TO "service_role";



GRANT ALL ON TABLE "public"."v_vagas_pipeline" TO "anon";
GRANT ALL ON TABLE "public"."v_vagas_pipeline" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vagas_pipeline" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_schedules" TO "anon";
GRANT ALL ON TABLE "public"."vacation_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."vacations" TO "anon";
GRANT ALL ON TABLE "public"."vacations" TO "authenticated";
GRANT ALL ON TABLE "public"."vacations" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_ambiente" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_ambiente" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_dia_semana" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_dia_semana" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_funcionarios" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_funcionarios" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_mensal" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_mensal" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_periodo" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_periodo" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_produtos" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_consolidado_turno" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_consolidado_turno" TO "service_role";



GRANT ALL ON TABLE "public"."vendas_diarias" TO "anon";
GRANT ALL ON TABLE "public"."vendas_diarias" TO "authenticated";
GRANT ALL ON TABLE "public"."vendas_diarias" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vendas_diarias_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vendas_diarias_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vendas_diarias_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."warnings" TO "anon";
GRANT ALL ON TABLE "public"."warnings" TO "authenticated";
GRANT ALL ON TABLE "public"."warnings" TO "service_role";



GRANT ALL ON TABLE "public"."work_schedules" TO "anon";
GRANT ALL ON TABLE "public"."work_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."work_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."workday_caixas" TO "anon";
GRANT ALL ON TABLE "public"."workday_caixas" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_caixas" TO "service_role";



GRANT ALL ON TABLE "public"."workday_grupos" TO "anon";
GRANT ALL ON TABLE "public"."workday_grupos" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_grupos" TO "service_role";



GRANT ALL ON TABLE "public"."workday_produtos" TO "anon";
GRANT ALL ON TABLE "public"."workday_produtos" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_produtos" TO "service_role";



GRANT ALL ON TABLE "public"."workday_resumo" TO "anon";
GRANT ALL ON TABLE "public"."workday_resumo" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_resumo" TO "service_role";



GRANT ALL ON TABLE "public"."workday_usuarios" TO "anon";
GRANT ALL ON TABLE "public"."workday_usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."workday_venda" TO "anon";
GRANT ALL ON TABLE "public"."workday_venda" TO "authenticated";
GRANT ALL ON TABLE "public"."workday_venda" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "mise" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public','mise','opx') LOOP
 EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',t.schemaname,t.tablename);
 END LOOP;
END $$;
COMMIT;
