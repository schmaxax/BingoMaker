export function ProgressPhoto({
  src,
  alt,
  maxHeightClass = "max-h-64",
  className = "",
}: {
  src: string;
  alt: string;
  maxHeightClass?: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-paper-deep ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={`w-full ${maxHeightClass} object-contain`} />
    </div>
  );
}
