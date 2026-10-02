import { MainNavigation } from "@/components/layout/main-navigation";

export default function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <MainNavigation />
    </>
  );
}
