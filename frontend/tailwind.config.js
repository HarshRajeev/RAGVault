/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17211b',
        field: '#f4f6f1',
        moss: '#556b4d',
        spruce: '#1f4b42',
        coral: '#c86450',
        marigold: '#d39c35',
      },
      boxShadow: {
        toolbar: '0 1px 0 rgba(23, 33, 27, 0.08)',
      },
    },
  },
  plugins: [],
};
