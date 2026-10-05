import { Sidebar } from "@/components/Sidebar";
import { fetchNavConfig } from "@/lib/nav/fetchNavConfig";

export const dynamic = "force-dynamic";

export default async function MiseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const navConfig = await fetchNavConfig();

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar
        navGroups={navConfig.groups}
        shellUrl={navConfig.shellUrl}
        navOffline={navConfig.offline}
        navVersao={navConfig.versao}
      />
      <main className="maza-page-main" style={{ flex: 1, overflowY: "auto", padding: "32px 28px" }}>
        {children}
      </main>
    </div>
  );
}
