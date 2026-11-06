export default function Heading({ eyebrow, title, as: Tag = "h2", center = false, children, className = "" }) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-2xl ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag className="section-title mt-2">{title}</Tag>
      {children && <div className="lead mt-5">{children}</div>}
    </div>
  );
}
