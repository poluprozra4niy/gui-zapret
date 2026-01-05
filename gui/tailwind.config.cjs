/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0a0a0f',
                primary: '#3b82f6',
                secondary: '#06b6d4',
                accent: '#8b5cf6',
            }
        },
    },
    plugins: [],
}
