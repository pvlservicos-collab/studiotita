/**
 * Rosto do Bilbo: emoji 3D "Disguised face" (óculos e bigode) do Fluent Emoji
 * da Microsoft (licença MIT), servido pelo próprio site em /bilbo-3d.png.
 * Imagem em vez do caractere 🥸, que não existe no Windows 10.
 */
export default function BilboFace({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/bilbo-3d.png" alt="Bilbo" width={size} height={size} className={`inline-block select-none ${className}`} draggable={false} />
  );
}
