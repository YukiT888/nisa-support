/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        kachi: {
          DEFAULT: '#0F2540',
          shade: '#0B1B31',
          tint: '#163253',
          accent: '#6BA4FF',
          accent2: '#C7A66B',
          surface: '#F7F8FA',
          textdark: '#F2F5FA'
        },
        signal: {
          buy: '#1B998B',
          sell: '#F45B69',
          neutral: '#FFB400'
        }
      },
      boxShadow: {
        kachi: '0 10px 30px -15px rgba(15, 37, 64, 0.4)'
      }
    }
  }
};
