import type { SVGProps } from 'react';

type MandalaLogoProps = SVGProps<SVGSVGElement>;

export function MandalaLogo(props: MandalaLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="32" r="7" />
        <circle cx="32" cy="16" r="16" />
        <circle cx="43.3" cy="20.7" r="16" />
        <circle cx="48" cy="32" r="16" />
        <circle cx="43.3" cy="43.3" r="16" />
        <circle cx="32" cy="48" r="16" />
        <circle cx="20.7" cy="43.3" r="16" />
        <circle cx="16" cy="32" r="16" />
        <circle cx="20.7" cy="20.7" r="16" />
        <ellipse cx="32" cy="23.5" rx="4.75" ry="10" />
        <ellipse cx="38.01" cy="25.99" rx="4.75" ry="10" transform="rotate(45 38.01 25.99)" />
        <ellipse cx="40.5" cy="32" rx="4.75" ry="10" transform="rotate(90 40.5 32)" />
        <ellipse cx="38.01" cy="38.01" rx="4.75" ry="10" transform="rotate(135 38.01 38.01)" />
        <ellipse cx="32" cy="40.5" rx="4.75" ry="10" />
        <ellipse cx="25.99" cy="38.01" rx="4.75" ry="10" transform="rotate(45 25.99 38.01)" />
        <ellipse cx="23.5" cy="32" rx="4.75" ry="10" transform="rotate(90 23.5 32)" />
        <ellipse cx="25.99" cy="25.99" rx="4.75" ry="10" transform="rotate(135 25.99 25.99)" />
      </g>
    </svg>
  );
}
