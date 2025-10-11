/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
        '4xl': '2560px',
      },
      colors: {
        backdrop: 'rgb(var(--color-backdrop))',
        primary: 'rgb(var(--color-text-primary))',
        secondary: 'rgb(var(--color-text-secondary))',
        glass: {
          DEFAULT: 'rgb(var(--glass-bg) / var(--glass-bg-opacity))',
          hover: 'rgb(var(--glass-bg) / var(--glass-bg-hover-opacity))',
          strong: 'rgb(var(--glass-bg) / var(--glass-bg-strong-opacity))',
          stronger: 'rgb(var(--glass-bg) / var(--glass-bg-stronger-opacity))',
        },
        glassBorder: 'rgb(var(--glass-border) / var(--glass-border-opacity))',
        button: {
          primary: 'rgb(var(--color-button-primary))',
          secondary: 'rgb(var(--color-button-secondary))',
        },
        background: {
          1: 'rgb(var(--color-background1))',
          2: 'rgb(var(--color-background2))',
          3: 'rgb(var(--color-background3))',
          4: 'rgb(var(--color-background4))',
          5: 'rgb(var(--color-background5))',
        },
        human: {
          1: 'rgb(var(--color-human-accent1))',
          2: 'rgb(var(--color-human-accent2))',
          3: 'rgb(var(--color-human-accent3))',
          4: 'rgb(var(--color-human-accent4))',
        },
        engine: {
          1: 'rgb(var(--color-engine-accent1))',
          2: 'rgb(var(--color-engine-accent2))',
          3: 'rgb(var(--color-engine-accent3))',
          4: 'rgb(var(--color-engine-accent4))',
        },
      },
      fontSize: {
        xxs: ['0.625rem', { lineHeight: '0.875rem' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
