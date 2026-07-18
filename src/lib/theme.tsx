"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type ThemeMode = "light" | "dark";
export type TextSize = "normal" | "large" | "xlarge";

interface ThemeCtx {
  theme: ThemeMode;
  textSize: TextSize;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setTextSize: (s: TextSize) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const THEME_KEY = "keidence.theme";
const TEXT_KEY = "keidence.textSize";

function applyTheme(theme: ThemeMode, textSize: TextSize) {
  const html = document.documentElement;
  html.classList.toggle("dark", theme === "dark");
  html.dataset.textSize = textSize;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [textSize, setTextSizeState] = useState<TextSize>("normal");

  // Read persisted preferences on mount (the inline script already applied
  // them to <html> to avoid a flash; this syncs React state).
  useEffect(() => {
    try {
      const t = (localStorage.getItem(THEME_KEY) as ThemeMode) || "light";
      const s = (localStorage.getItem(TEXT_KEY) as TextSize) || "normal";
      setThemeState(t);
      setTextSizeState(s);
      applyTheme(t, s);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback(
    (t: ThemeMode) => {
      setThemeState(t);
      applyTheme(t, textSize);
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        /* ignore */
      }
    },
    [textSize]
  );

  const setTextSize = useCallback(
    (s: TextSize) => {
      setTextSizeState(s);
      applyTheme(theme, s);
      try {
        localStorage.setItem(TEXT_KEY, s);
      } catch {
        /* ignore */
      }
    },
    [theme]
  );

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [theme, setTheme]
  );

  return (
    <Ctx.Provider
      value={{ theme, textSize, setTheme, toggleTheme, setTextSize }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/**
 * Inline script injected in <head> to apply the saved theme/text size before
 * first paint, preventing a flash of the wrong theme.
 */
export const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('${THEME_KEY}') || 'light';
    var s = localStorage.getItem('${TEXT_KEY}') || 'normal';
    if (t === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.dataset.textSize = s;
  } catch (e) {}
})();
`;
