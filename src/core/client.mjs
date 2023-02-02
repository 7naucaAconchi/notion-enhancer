/**
 * notion-enhancer
 * (c) 2023 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://notion-enhancer.github.io/) under the MIT license
 */

import { checkForUpdate } from "./update.mjs";

const notionSidebar = `.notion-sidebar-container .notion-sidebar > :nth-child(3) > div > :nth-child(2)`;

function SidebarButton(
  { icon, notifications, themeOverridesLoaded, ...props },
  ...children
) {
  const { html } = globalThis.__enhancerApi;
  return html`<div
    tabindex="0"
    role="button"
    class="notion-enhancer--menu-button
    flex select-none cursor-pointer rounded-[3px]
    text-[14px] my-px mx-[4px] py-[2px] px-[10px]
    transition hover:bg-[color:var(--theme--bg-hover)]"
    ...${props}
  >
    <div class="flex items-center justify-center w-[22px] h-[22px] mr-[8px]">
      <i class="i-${icon}"></i>
    </div>
    <div>${children}</div>

    <div class="ml-auto my-auto${notifications > 0 ? "" : " hidden"}">
      <!-- accents are squashed into one variable for theming:
      use rgb to match notion if overrides not loaded -->
      <div
        class="flex justify-center w-[16px] h-[16px] font-semibold
        text-([10px] [color:var(--theme--accent-secondary\\_contrast)])
        bg-[color:var(--theme--accent-secondary)] rounded-[3px] mb-[2px]
        dark:bg-[color:${themeOverridesLoaded
          ? "var(--theme--accent-secondary)"
          : "rgb(180,65,60)"}]"
      >
        <span class="ml-[-0.5px]">${notifications}</span>
      </div>
    </div>
  </div>`;
}

export default async (api, db) => {
  const {
      html,
      platform,
      version,
      getMods,
      isEnabled,
      enhancerUrl,
      onMessage,
      sendMessage,
      addMutationListener,
      addKeyListener,
      initDatabase,
    } = api,
    openMenuHotkey = await db.get("openMenuHotkey"),
    menuButtonIconStyle = await db.get("menuButtonIconStyle"),
    loadThemeOverrides = await db.get("loadThemeOverrides"),
    customStyles = (await db.get("customStyles"))?.content;

  // appearance

  const enabledThemes = (await getMods("themes")).map((theme) =>
      isEnabled(theme.id)
    ),
    forceLoadOverrides = loadThemeOverrides === "Enabled",
    autoLoadOverrides =
      loadThemeOverrides === "Auto" &&
      (await Promise.all(enabledThemes)).some((enabled) => enabled);
  if (forceLoadOverrides || autoLoadOverrides) {
    document.head.append(html`<link
      rel="stylesheet"
      href=${enhancerUrl("core/theme.css")}
    />`);
  }

  if (customStyles) {
    const $customStyles = html`<style>
      ${customStyles}
    </style>`;
    document.head.append($customStyles);
  }

  // menu

  let $menuModal, $menuFrame, _notionTheme;
  const updateTheme = (force = false) => {
    const darkMode = document.body.classList.contains("dark"),
      notionTheme = darkMode ? "dark" : "light";
    if (notionTheme !== _notionTheme || force) {
      _notionTheme = notionTheme;
      const msg = {
        namespace: "notion-enhancer",
        hotkey: openMenuHotkey,
        theme: notionTheme,
        icon: menuButtonIconStyle,
      };
      $menuFrame?.contentWindow.postMessage(msg, "*");
    }
  };

  const openMenu = () => {
      updateTheme(true);
      $menuModal?.setAttribute("open", true);
      $menuFrame?.contentWindow.focus();
    },
    closeMenu = () => $menuModal?.removeAttribute("open");

  $menuFrame = html`<iframe
    title="notion-enhancer menu"
    src="${enhancerUrl("core/menu/index.html")}"
    class="rounded-[5px] w-[1150px] h-[calc(100vh-100px)]
    max-w-[calc(100vw-100px)] max-h-[715px] overflow-hidden
    bg-[color:var(--theme--bg-primary)] drop-shadow-xl
    group-open:(pointer-events-auto opacity-100 scale-100)
    transition opacity-0 scale-95"
    onload=${() => {
      // pass notion-enhancer api to electron menu process
      if (platform !== "browser") {
        $menuFrame.contentWindow.__enhancerApi = api;
      }
      // menu relies on updateTheme for render trigger
      updateTheme(true);
    }}
  ></iframe>`;
  $menuModal = html`<div
    class="notion-enhancer--menu-modal group
    z-[999] fixed inset-0 w-screen h-screen
    transition pointer-events-none opacity-0
    open:(pointer-events-auto opacity-100)"
  >
    <div
      class="fixed inset-0 bg-[color:var(--theme--bg-overlay)]"
      onclick=${closeMenu}
    ></div>
    <div
      class="fixed inset-0 flex w-screen h-screen
      items-center justify-center pointer-events-none"
    >
      ${$menuFrame}
    </div>
  </div>`;
  document.body.append($menuModal);

  const $menuButton = html`<${SidebarButton}
    onclick=${openMenu}
    notifications=${(await checkForUpdate()) ? 1 : 0}
    icon="notion-enhancer${menuButtonIconStyle === "Monochrome"
      ? "?mask"
      : " text-[16px]"}"
    >notion-enhancer
  <//>`;
  addMutationListener(notionSidebar, () => {
    if (document.contains($menuButton)) return;
    document.querySelector(notionSidebar)?.append($menuButton);
  });
  document.querySelector(notionSidebar)?.append($menuButton);

  window.addEventListener("focus", () => updateTheme(true));
  window.addEventListener("message", (event) => {
    if (event.data?.namespace !== "notion-enhancer") return;
    if (event.data?.action === "close-menu") closeMenu();
    if (event.data?.action === "open-menu") openMenu();
  });
  addMutationListener("body", () => {
    if ($menuModal?.hasAttribute("open")) updateTheme();
  });
  onMessage("notion-enhancer", (message) => {
    if (message === "open-menu") openMenu();
  });
  addKeyListener(openMenuHotkey, (event) => {
    event.preventDefault();
    openMenu();
  });
  addKeyListener("Escape", () => {
    if (document.activeElement?.nodeName === "INPUT") return;
    closeMenu();
  });

  sendMessage("notion-enhancer", "load-complete");

  if ((await initDatabase().get("agreedToTerms")) === version) {
    // telemetry
  }
};
