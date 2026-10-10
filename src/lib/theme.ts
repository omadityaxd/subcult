export type ThemeMode = "dark" | "light"

export const THEME_STORAGE_KEY = "subcult-theme"

/**
 * Runs before first paint (inlined in <head>) so light-mode users never see a
 * dark flash. Dark is the server-rendered default.
 */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})==="light")document.documentElement.classList.remove("dark")}catch(e){}`
