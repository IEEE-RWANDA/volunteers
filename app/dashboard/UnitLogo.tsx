import Image from "next/image";

export default function UnitLogo({ unit }: { unit: { id: string; name: string; logoId?: string } }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-paper-2 text-sm font-bold text-blue" aria-hidden="true">
      {unit.logoId ? (
        <Image src={`/api/volunteer-units/${unit.id}/logo`} alt="" width={44} height={44} unoptimized className="size-full bg-white object-contain p-1" />
      ) : unit.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}
    </span>
  );
}
