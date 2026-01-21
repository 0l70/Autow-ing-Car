/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
    	extend: {
    		colors: {
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'var(--background)',
    			foreground: 'var(--foreground)',
                // Explicit Figma Tokens
                'bg-primary': 'var(--bg-primary)',
                'bg-secondary': 'hsl(var(--bg-secondary))',
                'bg-tertiary': 'hsl(var(--bg-tertiary))',
                'gray-600': 'hsl(var(--gray-600))',
                'gray-400': 'hsl(var(--gray-400))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))',
                    cyan: 'hsl(var(--accent-cyan))',
                    lime: 'hsl(var(--accent-lime))',
                    amber: 'hsl(var(--accent-amber))',
                    red: 'hsl(var(--accent-red))',
                    orange: 'hsl(var(--accent-orange))',
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
            boxShadow: {
                'glow-soft': 'var(--glow-soft)',
                'glow-strong': 'var(--glow-strong)',
            },
            fontFamily: {
                // Large Text: Clean, Modern (Apple System style)
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
                // Small Text: Technical, Code (SF Mono style)
                mono: ['"SF Mono"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
            }
    	}
    },
    plugins: [require("tailwindcss-animate")],
}
