/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/features/**/*.{js,jsx,ts,tsx}',
    './src/views/**/*.{js,jsx,ts,tsx}',
    './src/commons/**/*.{js,jsx,ts,tsx}',
    './src/stores/**/*.{js,jsx,ts,tsx}',
    './src/views/index.html',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--card) / <alpha-value>)',
        'surface-hover': 'rgb(var(--accent) / <alpha-value>)',
        'surface-active': 'rgb(var(--accent) / <alpha-value>)',
        'surface-secondary': 'var(--bg-secondary)',
        'surface-tertiary': 'var(--bg-tertiary)',
        'border-secondary': 'var(--border-secondary)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-light': 'rgb(var(--primary) / <alpha-value>)',
        'primary-hover': 'var(--primary-hover)',
        'primary-alpha': 'rgb(var(--primary) / 0.1)',
        'sidebar-hover': 'var(--sidebar-hover)',
        'dropdown-bg': 'var(--dropdown-bg, white)',
        'dropdown-border': 'var(--dropdown-border, transparent)',
        'dropdown-text': 'var(--dropdown-text, black)',
        'dropdown-hover-bg': 'var(--dropdown-hover-bg, #efefef)',
        'dropdown-active-bg': 'var(--dropdown-active-bg, #e8e8e8)',
        'resize-handle': 'var(--resize-handle-color)',
        'resize-handle-hover': 'var(--resize-handle-hover-color)',
        'resize-handle-active': 'var(--resize-handle-active-color)',
        'border-primary': 'var(--border-primary)',
        'border-tertiary': 'var(--border-tertiary)',
        text: 'rgb(var(--foreground) / <alpha-value>)',
        'text-muted': 'rgb(var(--muted-foreground) / <alpha-value>)',
        'text-dim': 'rgb(var(--muted-foreground) / <alpha-value>)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-primary': 'var(--text-primary)',
        'text-link': 'var(--text-link)',
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
          hover: 'rgb(var(--card-hover) / <alpha-value>)', // Distinct hover state
          active: 'rgb(var(--card-active) / <alpha-value>)', // Distinct active state
        },
        'button-special': 'rgb(var(--secondary) / <alpha-value>)',
        overlay: 'var(--bg-overlay)',
        'link-dialog-bg': 'var(--link-dialog-bg)',
        'modal-input-background': 'var(--modal-input-background)',
        tertiary: 'var(--background-tertiary)',
        secondary: 'var(--bg-secondary)',
        hover: 'var(--bg-hover)',
        'accent-primary': 'var(--accent-primary)',
        'accent-primary-dark': 'var(--accent-primary-dark)',
        error: 'var(--error)',
        'tooltip-kbd-bg': 'var(--tooltip-kbd-bg)',
        'tooltip-kbd-border': 'var(--tooltip-kbd-border)',
        'shortcuts-help-dialog-bg': 'var(--shortcuts-help-dialog-bg)',
        'shortcut-keys-bg': 'var(--shortcut-keys-bg)',
        'shortcuts-help-footer-kbd-bg': 'var(--shortcuts-help-footer-kbd-bg)',
        'bg-hover': 'var(--bg-hover)',
        brand: 'var(--brand-primary)',
        'brand-hover': 'var(--brand-primary-hover)',
        success: 'var(--color-success-green)',
        warning: 'var(--color-warning-orange)',
        danger: 'var(--color-error-red)',
        info: 'var(--color-info-blue)',
        cyan: 'var(--color-cyan)',
        'cyan-light': 'var(--color-cyan-light)',
        'cyan-alpha': 'var(--cyan-opacity-20)',
        purple: 'var(--color-purple)',
        blue: 'var(--color-info-blue)',
        green: {
          DEFAULT: 'var(--color-success-green)',
          50: 'rgba(34, 197, 94, 0.05)',
          100: 'rgba(34, 197, 94, 0.1)',
          200: 'rgba(34, 197, 94, 0.2)',
          300: 'rgba(34, 197, 94, 0.3)',
          400: 'rgba(34, 197, 94, 0.4)',
          500: 'var(--color-success-green)',
        },
        orange: 'var(--color-warning-orange)',
        red: {
          DEFAULT: 'var(--color-error-red)',
          50: 'rgba(239, 68, 68, 0.05)',
          100: 'rgba(239, 68, 68, 0.1)',
          200: 'rgba(239, 68, 68, 0.2)',
          300: 'rgba(239, 68, 68, 0.3)',
          400: 'rgba(239, 68, 68, 0.4)',
          500: 'var(--color-error-red)',
        },
        gray: 'var(--color-gray-500)',
        'gray-dark': 'var(--color-gray-600)',
        'gray-darkest': 'var(--color-gray-900)',
        'gray-light': 'var(--color-gray-200)',
        'gray-lightest': 'var(--color-gray-100)',
        'blue-opacity-10': 'var(--blue-opacity-10)',
        'cyan-opacity-20': 'var(--cyan-opacity-20)',
        'purple-opacity-20': 'var(--purple-opacity-20)',
        'orange-opacity-10': 'var(--orange-opacity-10)',
        'red-opacity-10': 'var(--red-opacity-10)',
        'green-opacity-10': 'var(--green-opacity-10)',
        'terminal-bg': 'rgb(var(--color-terminal-bg) / <alpha-value>)',
        'terminal-scrollbar': 'rgb(var(--color-terminal-scrollbar) / <alpha-value>)',
      },
      spacing: {
        '2xs': 'var(--spacing-2xs)',
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
        xl: 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        '3xl': 'var(--spacing-3xl)',
        '4xl': 'var(--spacing-4xl)',
        '5xl': 'var(--spacing-5xl)',
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        md: 'var(--font-size-md)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
      },
      lineHeight: {
        tight: 'var(--line-height-tight)',
        normal: 'var(--line-height-normal)',
        relaxed: 'var(--line-height-relaxed)',
      },
      fontWeight: {
        light: 'var(--font-weight-light)',
        normal: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
        black: 'var(--font-weight-black)',
      },
      fontFamily: {
        mono: ['var(--font-family-mono)'],
        sans: ['var(--font-family-mono)'],
        kbd: ['Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 4px)',
        DEFAULT: 'var(--radius-md)',
        md: 'calc(var(--radius) - 2px)',
        lg: 'var(--radius)',
        xl: 'var(--radius-2xl)',
        full: 'var(--radius-full)',
        inherit: 'inherit',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        inner: 'var(--shadow-inner)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
        'detail-panel': 'var(--detail-panel-width)',
        'detail-panel-collapsed': 'var(--detail-panel-collapsed-width)',
        'min-content': 'var(--min-content-width)',
        'resize-handle': 'var(--resize-handle-width)',
        'resize-handle-hover': 'var(--resize-handle-hover-width)',
      },
      height: {
        25: '100px',
        50: '200px',
        header: 'var(--header-height)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '500ms',
      },
      zIndex: {
        base: '0',
        dropdown: '100',
        sticky: '200',
        overlay: '300',
        modal: '400',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        popover: '500',
        tooltip: '600',
        notification: '700',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-in-out',
        'slide-in-left': 'slideInLeft 300ms ease-out',
        'slide-in-right': 'slideInRight 300ms ease-out',
        'slide-in-up': 'slideInUp 300ms ease-out',
        shimmer: 'shimmer 2s infinite',
        slideDown: 'slideDown 0.3s ease-out',
        slideIn: 'slideIn 0.2s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'anchored-modal-fade-in': 'anchoredModalFadeIn var(--transition-base) ease-out',
        cursorBlink: 'cursorBlink 1s ease-in-out infinite',
        chipSlideIn: 'chipSlideIn 0.2s ease-out',
        menuSlideIn: 'menuSlideIn 0.2s ease-out',
        mentionInsert: 'mentionInsert 0.3s ease-out',
        imageInsert: 'imageInsert 0.3s ease-out',
        'slide-out-right': 'slideOutRight 300ms ease-in forwards',
        progress: 'progress linear forwards',
        'tooltip-fade-in': 'tooltipFadeIn 0.2s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        anchoredModalFadeIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        slideInLeft: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(0)',
          },
        },
        slideInRight: {
          '0%': {
            transform: 'translateX(100%)',
          },
          '100%': {
            transform: 'translateX(0)',
          },
        },
        slideInUp: {
          '0%': {
            transform: 'translateY(100%)',
          },
          '100%': {
            transform: 'translateY(0)',
          },
        },
        slideIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.95) translateY(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1) translateY(0)',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-200% 0',
          },
          '100%': {
            backgroundPosition: '200% 0',
          },
        },
        slideDown: {
          from: {
            maxHeight: '0',
            opacity: '0',
            paddingTop: '0',
            paddingBottom: '0',
          },
          to: {
            maxHeight: '200px',
            opacity: '1',
            paddingTop: 'var(--spacing-md)',
            paddingBottom: 'var(--spacing-md)',
          },
        },
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px var(--success-alpha)',
          },
          '50%': {
            boxShadow: '0 0 20px var(--success)',
          },
        },
        cursorBlink: {
          '0%, 50%': {
            opacity: '1',
          },
          '51%, 100%': {
            opacity: '0',
          },
        },
        chipSlideIn: {
          from: {
            opacity: '0',
            transform: 'scale(0.8)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        menuSlideIn: {
          from: {
            opacity: '0',
            transform: 'translateY(-8px) scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        mentionInsert: {
          from: {
            opacity: '0',
            transform: 'scale(0.9)',
          },
          to: {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        imageInsert: {
          from: {
            opacity: '0',
            transform: 'translateY(20px) scale(0.95)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        slideOutRight: {
          from: {
            transform: 'translateX(0)',
            opacity: '1',
          },
          to: {
            transform: 'translateX(110%)',
            opacity: '0',
          },
        },
        progress: {
          from: {
            width: '100%',
          },
          to: {
            width: '0',
          },
        },
        'accordion-down': {
          from: {
            height: 0,
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: 0,
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Custom plugin for utility classes that match existing patterns
    function ({ addUtilities, theme }) {
      const newUtilities = {
        // Resize handle utilities for ResizablePanel
        '.resize-handle-base': {
          width: 'var(--resize-handle-width)',
          backgroundColor: 'var(--resize-handle-color)',
          '&:hover, &:focus-visible': {
            width: 'var(--resize-handle-hover-width)',
            backgroundColor: 'var(--resize-handle-hover-color)',
          },
        },
        '.resize-handle-left': {
          right: 'calc(var(--resize-handle-width) / -2)',
          '&:hover, &:focus-visible': {
            right: 'calc(var(--resize-handle-hover-width) / -2)',
          },
        },
        '.resize-handle-right': {
          left: 'calc(var(--resize-handle-width) / -2)',
          '&:hover, &:focus-visible': {
            left: 'calc(var(--resize-handle-hover-width) / -2)',
          },
        },
        '.resize-handle-active': {
          width: 'var(--resize-handle-hover-width) !important',
          backgroundColor: 'var(--resize-handle-active-color) !important',
          '&.resize-handle-left': {
            right: 'calc(var(--resize-handle-hover-width) / -2) !important',
          },
          '&.resize-handle-right': {
            left: 'calc(var(--resize-handle-hover-width) / -2) !important',
          },
        },

        // Prevent transition during resize and user selection
        'body.resizing .resizable-panel': {
          transition: 'none !important',
        },
        'body.resizing': {
          userSelect: 'none',
          WebkitUserSelect: 'none',
        },

        // Text selection colors
        '.selection-primary': {
          '&::selection': {
            backgroundColor: theme('colors.primary'),
            color: theme('colors.background'),
          },
        },

        // Focus visible utilities
        '.focus-ring': {
          '&:focus-visible': {
            outline: `2px solid ${theme('colors.info')}`,
            outlineOffset: '2px',
          },
        },

        // Scrollbar styling
        '.scrollbar-thin': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme('colors.border-secondary'),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme('colors.text-tertiary'),
          },
        },

        // Specific emoji picker scrollbar
        '.scrollbar-thumb-rounded': {
          '&::-webkit-scrollbar': {
            height: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--border-color)',
            borderRadius: '2px',
          },
        },

        // Rich text editor content styles
        '.editor-content-styles': {
          // Mention styling
          '& .mention': {
            display: 'inline-block',
            padding: '2px 6px',
            margin: '0 2px',
            background: 'var(--accent-primary-alpha)',
            color: 'var(--accent-primary)',
            borderRadius: '4px',
            fontWeight: '500',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background-color 0.2s',
            animation: 'mentionInsert 0.3s ease-out',
          },
          '& .mention:hover': {
            background: 'var(--accent-primary)',
            color: 'white',
            transform: 'translateY(-1px)',
          },

          // Task list styling
          '& .task-list': {
            margin: '8px 0',
            listStyle: 'none',
            paddingLeft: '0',
          },
          '& .task-list-item': {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--spacing-xs)',
            margin: 'var(--spacing-xs) 0',
          },
          '& .task-list-item input[type="checkbox"]': {
            marginTop: '0.25em',
            cursor: 'pointer',
          },

          // Code styling
          '& code': {
            background: 'var(--bg-tertiary)',
            padding: '2px 4px',
            borderRadius: '3px',
            fontFamily: 'inherit',
            fontSize: '0.9em',
            color: 'var(--text-code)',
            transition: 'background-color var(--transition-fast)',
          },

          // Pre/Code blocks
          '& pre': {
            background: 'var(--bg-tertiary)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--spacing-sm) 0',
            overflowX: 'auto',
            transition: 'all var(--transition-fast)',
          },
          '& pre:hover': {
            boxShadow: 'var(--shadow-sm)',
          },
          '& pre code': {
            background: 'none',
            padding: '0',
            border: 'none',
          },

          // Blockquote styling
          '& blockquote': {
            borderLeft: '3px solid var(--border-secondary)',
            paddingLeft: '12px',
            margin: '8px 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          },

          // Text formatting
          '& strong, & b': {
            fontWeight: 'var(--font-weight-bold)',
          },
          '& em, & i': {
            fontStyle: 'italic',
          },
          '& del, & s': {
            textDecoration: 'line-through',
          },
          '& a': {
            color: 'var(--text-link)',
            textDecoration: 'underline',
            cursor: 'pointer',
          },
          '& a:hover': {
            color: 'var(--text-link-hover)',
          },

          // Lists
          '& ul, & ol': {
            margin: 'var(--spacing-sm) 0',
            paddingLeft: 'var(--spacing-xl)',
          },
          '& ul': {
            listStyleType: 'disc',
          },
          '& ol': {
            listStyleType: 'decimal',
          },
          '& li': {
            margin: 'var(--spacing-2xs) 0',
          },

          // Images
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 'var(--radius-md)',
            margin: 'var(--spacing-sm) 0',
            animation: 'imageInsert 0.3s ease-out',
            transition: 'all var(--transition-fast)',
          },
          '& img:hover': {
            boxShadow: 'var(--shadow-md)',
            transform: 'scale(1.02)',
          },
        },

        // Markdown content styles
        '.markdown-content-styles': {
          // Force all text elements to inherit font size
          '& *': {
            fontSize: 'inherit',
          },

          // Paragraphs
          '& p': {
            margin: '0.25em 0',
            fontSize: '1em !important',
          },
          '& p:first-child': {
            marginTop: '0',
          },
          '& p:last-child': {
            marginBottom: '0',
          },

          // Headings
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            margin: '0.5em 0 0.25em',
            fontWeight: '600',
            fontSize: '1em !important',
          },

          // Lists
          '& ul, & ol': {
            margin: '0.5em 0',
            paddingLeft: '2em',
          },
          '& ul': {
            listStyleType: 'disc',
          },
          '& ol': {
            listStyleType: 'decimal',
          },
          '& li': {
            margin: '0.25em 0',
          },

          // Blockquotes
          '& blockquote': {
            margin: '0.5em 0',
            padding: '0.5em 1em',
            borderLeft: '3px solid var(--border)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },

          // Code
          '& code': {
            fontSize: '0.9em',
            padding: '0.1em 0.3em',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
          },

          // Pre blocks
          '& pre': {
            margin: '0.5em 0',
            overflowX: 'auto',
          },
          '& pre code': {
            display: 'block',
            padding: '1em',
            backgroundColor: 'transparent',
          },

          // Tables
          '& table': {
            borderCollapse: 'collapse',
            margin: '0.5em 0',
            width: '100%',
          },
          '& th, & td': {
            border: '1px solid var(--border)',
            padding: '0.5em',
            textAlign: 'left',
          },
          '& th': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            fontWeight: '600',
          },

          // Horizontal rules
          '& hr': {
            margin: '1em 0',
            border: 'none',
            borderTop: '1px solid var(--border)',
          },

          // Links
          '& a': {
            color: 'var(--primary)',
            textDecoration: 'none',
            cursor: 'pointer',
          },
          '& a:hover': {
            textDecoration: 'underline',
          },

          // Images
          '& img': {
            maxWidth: '100%',
            height: 'auto',
          },

          // Text formatting
          '& strong': {
            fontWeight: '600',
          },
          '& em': {
            fontStyle: 'italic',
          },

          // Syntax highlighting adjustments
          '& pre > div': {
            backgroundColor: '#1e1e1e !important',
            border: '1px solid var(--border)',
          },
        },

        // Diff viewer styles
        '.diff-viewer-styles': {
          '& .diff-content': {
            overflowY: 'auto',
            maxHeight: '400px',
            overflowX: 'hidden',
          },

          '& .diff-hunk': {
            margin: '0',
          },

          '& .diff-hunk-header': {
            background: 'var(--background-tertiary)',
            color: 'var(--info)',
            padding: '4px 12px',
            fontSize: '11px',
            fontWeight: '500',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
          },

          '& .diff-line': {
            display: 'flex',
            lineHeight: '1.4',
            position: 'relative',
            alignItems: 'flex-start',
          },

          '& .diff-line-number': {
            display: 'flex',
            minWidth: '80px',
            background: 'var(--background-tertiary)',
            borderRight: '1px solid var(--border)',
            userSelect: 'none',
            flexShrink: '0',
          },

          '& .diff-line-old, & .diff-line-new': {
            width: '40px',
            textAlign: 'right',
            padding: '0 8px',
            color: 'var(--text-tertiary)',
            fontSize: '11px',
          },

          '& .diff-line-sign': {
            width: '20px',
            textAlign: 'center',
            userSelect: 'none',
            fontWeight: '600',
            flexShrink: '0',
          },

          '& .diff-line-content': {
            flex: '1',
            paddingLeft: '8px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
            minWidth: '0',
          },

          // Context lines
          '& .diff-context': {
            background: 'var(--background-primary)',
            color: 'var(--text-secondary)',
          },
          '& .diff-context .diff-line-sign': {
            color: 'var(--text-tertiary)',
          },

          // Added lines
          '& .diff-add': {
            background: 'rgba(46, 160, 67, 0.15)',
            color: 'var(--text-primary)',
          },
          '& .diff-add .diff-line-sign': {
            color: '#2ea043',
          },
          '& .diff-add .diff-line-new': {
            color: '#2ea043',
            fontWeight: '500',
          },

          // Removed lines
          '& .diff-remove': {
            background: 'rgba(248, 81, 73, 0.15)',
            color: 'var(--text-primary)',
          },
          '& .diff-remove .diff-line-sign': {
            color: '#f85149',
          },
          '& .diff-remove .diff-line-old': {
            color: '#f85149',
            fontWeight: '500',
          },

          // Meta lines
          '& .diff-meta': {
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            padding: '4px 12px',
          },

          '& .diff-empty': {
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          },

          // Night theme adjustments
          '.theme-night &': {
            '& .diff-add': {
              background: 'rgba(0, 255, 204, 0.1)',
            },
            '& .diff-add .diff-line-sign, & .diff-add .diff-line-new': {
              color: 'var(--cyber-cyan)',
            },
            '& .diff-remove': {
              background: 'rgba(255, 107, 107, 0.1)',
            },
            '& .diff-remove .diff-line-sign, & .diff-remove .diff-line-old': {
              color: '#ff6b6b',
            },
          },

          // Line wrapping styles
          '& .diff-line-number, & .diff-line-sign': {
            alignSelf: 'flex-start',
          },

          // Scrollbar styling
          '& .diff-content::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '& .diff-content::-webkit-scrollbar-track': {
            background: 'var(--background-secondary)',
          },
          '& .diff-content::-webkit-scrollbar-thumb': {
            background: 'var(--border-strong)',
            borderRadius: '4px',
          },
          '& .diff-content::-webkit-scrollbar-thumb:hover': {
            background: 'var(--text-tertiary)',
          },
        },

        // Glow effects for night theme
        '.glow-text': {
          textShadow: `0 0 10px ${theme('colors.cyan-alpha')}`,
        },

        '.glow-border': {
          boxShadow: `0 0 10px ${theme('colors.cyan-alpha')}`,
        },

        '.glow-border-strong': {
          boxShadow: `0 0 20px ${theme('colors.cyan-alpha')}`,
        },

        // Interactive state utilities
        '.interactive': {
          transition: 'all 150ms ease-out',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },

        // Truncate text utility
        '.truncate-text': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },

        // Card hover effect
        '.card-hover': {
          transition: 'all 200ms ease-in-out',
          '&:hover': {
            boxShadow: theme('boxShadow.md'),
            transform: 'translateY(-1px)',
          },
        },

        // Skeleton loading animation
        '.skeleton': {
          background: `linear-gradient(
            90deg,
            ${theme('colors.surface')} 0%,
            ${theme('colors.surface-hover')} 50%,
            ${theme('colors.surface')} 100%
          )`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
        },
      };

      addUtilities(newUtilities);
    },
  ],
};
