import { permanentRedirect } from "next/navigation";

export default async function DashboardRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [name, values] of Object.entries(await searchParams)) {
    if (values !== undefined) {
      for (const value of Array.isArray(values) ? values : [values]) query.append(name, value);
    }
  }
  permanentRedirect(query.size ? `/?${query}` : "/");
}
