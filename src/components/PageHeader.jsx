import Heading from "@/components/Heading";

export default function PageHeader({ eyebrow, title, intro, children }) {
  return (
    <header className="border-b border-white/10">
      <div className="container-page flex flex-wrap items-end justify-between gap-8 py-16 md:py-24">
        <Heading as="h1" eyebrow={eyebrow} title={title}>
          {intro}
        </Heading>
        {children && <div className="flex flex-wrap gap-3">{children}</div>}
      </div>
    </header>
  );
}
