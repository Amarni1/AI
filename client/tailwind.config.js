/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ma: {
          gold: "#D4AF37",
          white: "#FFFFFF",
          black: "#0A0A0A",
          panel: "rgba(255, 255, 255, 0.08)",
          ink: "#111827",
          cream: "#F6EFE1",
          navy: "#0F172A"
        }
      },
      boxShadow: {
        glow: "0 0 25px rgba(212, 175, 55, 0.35)",
        card: "0 24px 60px rgba(15, 23, 42, 0.14)",
        raised: "0 18px 40px rgba(15, 23, 42, 0.18)"
      },
      fontFamily: {
        display: ["Cormorant Garamond", "Georgia", "serif"],
        body: ["Manrope", "Segoe UI", "sans-serif"]
      },
      backgroundImage: {
        halo:
          "radial-gradient(circle at top, rgba(212, 175, 55, 0.22), transparent 36%), linear-gradient(180deg, #fffaf0 0%, #f4ecd8 100%)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.65", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.03)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.8s ease-in-out infinite",
        shimmer: "shimmer 2.8s linear infinite"
      }
    }
  },
  plugins: []
};
