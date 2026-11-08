import Image from 'next/image';

type Props = {
  className?: string;
};

export function BrandLogo({ className }: Props) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={282}
      src="/veto-logo.png"
      width={786}
    />
  );
}
