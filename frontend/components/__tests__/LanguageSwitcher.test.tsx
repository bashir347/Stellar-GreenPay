/**
 * components/__tests__/LanguageSwitcher.test.tsx
 *
 * Regression tests for #1073: picking a language in the navbar switcher
 * must survive a reload, and a saved preference must drive the control's
 * initial value.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { I18nProvider, LOCALE_STORAGE_KEY } from "@/lib/i18n";

beforeEach(() => {
  document.documentElement.lang = "en";
  localStorage.clear();
  Object.defineProperty(window.navigator, "languages", {
    value: ["en-US"],
    configurable: true,
  });
  Object.defineProperty(window.navigator, "language", {
    value: "en-US",
    configurable: true,
  });
});

function renderSwitcher() {
  return render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>,
  );
}

describe("LanguageSwitcher", () => {
  it("renders every supported locale", () => {
    renderSwitcher();
    const select = screen.getByLabelText("Language");
    expect(select).toHaveTextContent(/English/);
    expect(select).toHaveTextContent(/Español/);
    expect(select).toHaveTextContent(/Français/);
    expect(select).toHaveTextContent(/العربية/);
    expect(select.querySelector('option[value="es"]')).toHaveAttribute("lang", "es");
    expect(select).not.toHaveTextContent(/[🇺🇸🇪🇸🇫🇷🇸🇦]/u);
  });

  it("saves the picked locale under the namespaced key", () => {
    renderSwitcher();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } });

    expect(screen.getByRole("combobox", { name: "Langue" })).toHaveValue("fr");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
  });

  it("comes back pre-selected after a reload", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");

    renderSwitcher();

    // Remount to prove the control reads the preference, not its default.
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "es" } });
    expect(screen.getByRole("combobox", { name: "Idioma" })).toHaveValue("es");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("es");
  });

  it("selects, saves and applies pt-BR (hyphenated locale code)", () => {
    renderSwitcher();
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "pt-BR" } });

    expect(screen.getByLabelText("Language")).toHaveValue("pt-BR");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
  });

  it("comes back pre-selected as pt-BR after a reload", () => {
    // The isLocale guard must accept the hyphenated code on read-back.
    localStorage.setItem(LOCALE_STORAGE_KEY, "pt-BR");

    renderSwitcher();

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "pt-BR" } });
    expect(screen.getByLabelText("Language")).toHaveValue("pt-BR");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("pt-BR");
  });

  it("starts from the saved preference rather than the browser default", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
    Object.defineProperty(window.navigator, "languages", {
      value: ["de-DE"],
      configurable: true,
    });
    Object.defineProperty(window.navigator, "language", {
      value: "de-DE",
      configurable: true,
    });

    renderSwitcher();

    expect(screen.getByRole("combobox", { name: "Langue" })).toHaveValue("fr");
  });
});
