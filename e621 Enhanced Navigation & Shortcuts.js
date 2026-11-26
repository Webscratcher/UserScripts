// ==UserScript==
// @name         e621 Enhanced Navigation & Shortcuts
// @namespace    https://github.com/Webscratcher/UserScripts
// @version      1.7.1
// @license      GPL3
// @description  Enhances e621 with keyboard shortcuts for voting, favoriting, and navigation. Features auto-skip for blacklisted content, improved pool navigation, and smart behavior that disables shortcuts when typing or using video player.
// @author       Webscratcher
// @match        https://e621.net/posts*
// @match        https://e621.net/users/settings*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=e621.net
// @grant        unsafeWindow
// ==/UserScript==

// Configuration
const CONFIG = {
  shortcuts: {
    UPVOTE: { key: "KeyU", requiresShift: false },
    DOWNVOTE: { key: "KeyU", requiresShift: true },
    LIKE_AND_FAVORITE: { key: "KeyL", requiresShift: false },
    FAVORITE_AND_CONTINUE: { key: "KeyL", requiresShift: true },
    TOGGLE_FAVORITES: { key: "KeyI", requiresShift: false },
    TOGGLE_BLACKLIST: { key: "KeyB", requiresShift: false },
    NEXT_POST: { key: "ArrowRight", requiresShift: false },
    PREV_POST: { key: "ArrowLeft", requiresShift: false },
    TOGGLE_AUTOSKIP: { key: "KeyP", requiresShift: false },
  },
  selectors: {
    voteBox: "#ptbr-wrapper div.ptbr-vote",
    upvoteButton: "button:first-child",
    downvoteButton: "button:nth-child(4)",
    favoriteButton: "div.ptbr-favorite > button",
    unvaforiteButton: "div.ptbr-favorite > button",
    imageViewer: "img#image",
    mediaContainer: "media-container",
    siteUserScript: "script#site-user",
    wikiButtons: "a.tag-list-wiki",
    navigation: {
      next: "div#nav-links-top > div > ul > li > a.nav-link.next",
      prev: "div#nav-links-top > div > ul > li > a.nav-link.prev",
      searchField: "textarea#tags",
    },
    blacklist: {
      panel: "section.blacklist-ui:not(.blacklist-inline)",
      header: ".blacklist-header",
      toggleAll: ".blacklist-toggle-all",
      blacklistedContent: "#image-container.blacklisted",
    },
    pool: {
      nav: "#nav-links-top",
      link: "div.pool-nav > ul > li > span > a",
    },
  },
  delays: {
    defaultSleep: 2,
    voteDelay: 1,
    autoSkipDelay: 3, // 3 seconds countdown before skipping
  },
};

// Utility functions
class Utils {
  static async sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  static isElementVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return !(
      style.display === "none" ||
      style.visibility === "hidden" ||
      parseFloat(style.opacity) < 0.01 ||
      (rect.width === 0 && rect.height === 0)
    );
  }

  static isInteractiveElementFocused() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    const interactiveElements = ["INPUT", "TEXTAREA", "SELECT"];
    const mediaContainer = document.querySelector(CONFIG.selectors.mediaContainer);
    const isMediaContainerFocused =
      mediaContainer && mediaContainer.contains(activeElement);
    return (
      (interactiveElements.includes(activeElement.tagName) ||
        activeElement.isContentEditable ||
        isMediaContainerFocused) &&
      Utils.isElementVisible(activeElement)
    );
  }

  static async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  }
}

// DOM Manager for caching and managing DOM elements
class DOMManager {
  constructor() {
    this.elements = new Map();
    this.initializeElements();
  }

  initializeElements() {
    Object.entries(CONFIG.selectors).forEach(([key, selector]) => {
      if (typeof selector === "string") {
        this.elements.set(key, document.querySelector(selector));
      }
    });
  }

  getElement(key) {
    if (!this.elements.has(key) && key.split(".").length == 2) {
      let selector = CONFIG.selectors[key.split(".")[0]];
      const secondKey = key.split(".")[1];
      if (selector && selector[secondKey] !== null) {
        selector = selector[secondKey];
        this.elements.set(key, document.querySelector(selector));
      }
    }
    return this.elements.get(key);
  }

}

// Vote Manager
class VoteManager {
  constructor(domManager) {
    this.dom = domManager;
  }
  
  getVoteScore() {
    const voteBox = this.dom.getElement("voteBox");
    return voteBox.dataset.vote;
  }

  isAlreadyUpvoted() {
    return this.getVoteScore() == "1";
  }

  isAlreadyDownvoted() {
    return this.getVoteScore() == "-1";
  }

  isAlreadyFavorited() {
    const favoriteButton = this.dom.getElement("favoriteButton");
    return favoriteButton.attributes["favorited"].value == "true";
  }

  async upvote() {
    if (!this.isAlreadyUpvoted()) {
      const upvoteButton = this.dom
        .getElement("voteBox")
        ?.querySelector(CONFIG.selectors.upvoteButton);
      upvoteButton?.click();
      await Utils.sleep(CONFIG.delays.voteDelay);
      return;
    }
    return;
  }

  async downvote() {
    if (!this.isAlreadyDownvoted()) {
      const downvoteButton = this.dom
        .getElement("voteBox")
        ?.querySelector(CONFIG.selectors.downvoteButton);
      downvoteButton?.click();
      await Utils.sleep(CONFIG.delays.voteDelay);
      return;
    }
    return;
  }

  async favorite(disableUnfavorite = false) {
    if (!this.isAlreadyFavorited()) {
      const favoriteButton = this.dom.getElement("favoriteButton");
      favoriteButton?.click();
      await Utils.sleep(CONFIG.delays.voteDelay);
      return;
    } else if (this.isAlreadyFavorited() && !disableUnfavorite) {
      const unfavoritedButton = this.dom.getElement("unfavoriteButton");
      unfavoritedButton?.click();
      await Utils.sleep(CONFIG.delays.voteDelay);
      return;
    }
    return;
  }
}

// Navigation Manager
class NavigationManager {
  constructor(domManager) {
    this.dom = domManager;
  }

  goToNext() {
    const nextButton = document.querySelector(CONFIG.selectors.navigation.next);
    nextButton?.click();
  }

  goToPrev() {
    const prevButton = document.querySelector(CONFIG.selectors.navigation.prev);
    prevButton?.click();
  }
}

class UserActions {
  constructor() {
    this.LOCAL_STORAGE_KEY = "myCachedUsername";
    this.EXPIRATION_MS = 24 * 60 * 60 * 1000; // 1 day
  }

  // 1. Try to read the username from the base64-encoded site-user script tag
  getUsernameFromSiteData() {
    const scriptTag = document.querySelector(CONFIG.selectors.siteUserScript);
    if (!scriptTag?.textContent) return null;

    try {
      // The tag holds UTF-8 encoded JSON, so decode the base64 bytes explicitly
      const bytes = Uint8Array.from(atob(scriptTag.textContent.trim()), (c) =>
        c.charCodeAt(0),
      );
      const siteData = JSON.parse(new TextDecoder().decode(bytes));
      return typeof siteData?.name === "string" && siteData.name
        ? siteData.name
        : null;
    } catch {
      return null;
    }
  }

  // 2. Store username in localStorage with an expiration
  storeUsername(username) {
    const data = {
      username,
      expires: Date.now() + this.EXPIRATION_MS,
    };
    localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
  }

  // 3. Retrieve username from localStorage if it's not expired
  getStoredUsername() {
    const raw = localStorage.getItem(this.LOCAL_STORAGE_KEY);
    if (!raw) return null;

    const { username, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      return null;
    }
    return username;
  }

  // 4. Main function to obtain the username
  getUsername() {
    // First, check localStorage
    let username = this.getStoredUsername();
    if (username) return username;

    // Then, check the site-user script tag
    username = this.getUsernameFromSiteData();
    if (!username) {
      // Fallback to asking the user
      username = prompt("Please enter your username:")?.trim() || "";
    }

    if (username) this.storeUsername(username);
    return username;
  }

  // 5. Check if "-fav:<username>" is present in the search field and remove it if found
  ignoreFavoritePosts(wasShiftHeld = false, wasCtrlHeld = false) {
    const searchField = document.querySelector(
      CONFIG.selectors.navigation.searchField,
    );
    if (!searchField) return;

    const username = this.getUsername(); // Assume this.getUsername() retrieves the username
    if (!username) return;

    const negativeFavTag = `-fav:${username}`;
    const positiveFavTag = `fav:${username}`;

    // Regex to match the exact negative tag: '-fav:<username>' preceded by start or space,
    // and followed by space or end of string; case-insensitive so any writing style matches
    const negativeRegex = new RegExp(`(^|\\s)${negativeFavTag}(?=$|\\s)`, "gi");
    // Regex to match the exact positive tag: 'fav:<username>' preceded by start or space,
    // and followed by space or end of string; case-insensitive so any writing style matches
    const positiveRegex = new RegExp(`(^|\\s)${positiveFavTag}(?=$|\\s)`, "gi");

    // Helper to remove all occurrences (positive or negative) from the input
    const removeAllFavTags = (val) => {
      return val
        .replace(negativeRegex, "") // remove any negative
        .replace(positiveRegex, "") // remove any positive
        .replace(/\s+/g, " ") // normalize multiple spaces
        .trim();
    };

    // Helper to remove only the negative tag
    const removeNegativeFav = (val) => {
      return val.replace(negativeRegex, "").replace(/\s+/g, " ").trim();
    };

    // Helper to remove only the positive tag
    const removePositiveFav = (val) => {
      return val.replace(positiveRegex, "").replace(/\s+/g, " ").trim();
    };

    let currentValue = searchField.value || "";

    if (wasCtrlHeld) {
      // 1) CTRL key held: remove ALL fav tags
      currentValue = removeAllFavTags(currentValue);
    } else if (wasShiftHeld) {
      // 2) SHIFT key held => toggle "fav:<username>"
      if (positiveRegex.test(currentValue)) {
        // Already has 'fav:<username>', so remove it
        currentValue = removePositiveFav(currentValue);
      } else {
        // Remove any '-fav:<username>' first, then prepend 'fav:<username>'
        currentValue = removeNegativeFav(currentValue);
        currentValue = currentValue
          ? `${positiveFavTag} ${currentValue}`.trim()
          : positiveFavTag;
      }
    } else {
      // 3) NO SHIFT => toggle "-fav:<username>"
      if (negativeRegex.test(currentValue)) {
        // Already has '-fav:<username>', so remove it
        currentValue = removeNegativeFav(currentValue);
      } else {
        // Remove any 'fav:<username>' first, then prepend '-fav:<username>'
        currentValue = removePositiveFav(currentValue);
        currentValue = currentValue
          ? `${negativeFavTag} ${currentValue}`.trim()
          : negativeFavTag;
      }
    }

    // Update the input field
    searchField.value = currentValue;

    // Finally, find a button in the same parent container and click it to trigger the new search
    const parent = searchField.parentElement;
    if (parent) {
      const button = parent.querySelector("button");
      if (button) button.click();
    }
  }
}

// Blacklist Manager
class BlacklistManager {
  constructor(domManager) {
    this.dom = domManager;
  }

  async openBlacklist() {
    const panel = document.querySelector(CONFIG.selectors.blacklist.panel);
    if (panel?.getAttribute("collapsed") === "true") {
      panel.querySelector(CONFIG.selectors.blacklist.header)?.click();
      await Utils.sleep(CONFIG.delays.defaultSleep);
    }
  }

  async toggleBlacklist() {
    const panel = document.querySelector(CONFIG.selectors.blacklist.panel);
    const toggleButton = panel?.querySelector(CONFIG.selectors.blacklist.toggleAll);

    if (toggleButton) {
      toggleButton.click();
      await Utils.sleep(CONFIG.delays.defaultSleep);
    }
  }

  isImageBlacklisted() {
    // Check for the blacklisted image placeholder
    return (
      document.querySelector(CONFIG.selectors.blacklist.blacklistedContent) !==
      null
    );
  }
}

// Pool Manager
class PoolManager {
  constructor(domManager) {
    this.dom = domManager;
  }

  addCopyPoolID() {
    const navBar = this.dom.getElement("pool.nav");
    const poolLink = navBar?.querySelector(CONFIG.selectors.pool.link);

    if (!poolLink) return;

    const poolId = poolLink.href.split("/").pop();
    const copyButton = this.createCopyButton(poolId);
    navBar.appendChild(copyButton);
  }

  createCopyButton(poolId) {
    const container = document.createElement("div");
    container.className = "pool-nav";
    container.style.textAlign = "center";

    const button = document.createElement("a");
    button.textContent = `Copy Pool-ID: ${poolId}`;
    button.style.cursor = "pointer";
    button.addEventListener("click", async () => {
      const success = await Utils.copyToClipboard(poolId);
      alert(success ? `Copied Pool ID: ${poolId}` : "Failed to copy pool ID");
    });

    container.appendChild(button);
    return container;
  }
}

// Auto-Skip Manager
class AutoSkipManager {
  constructor(domManager, navigationManager, blacklistManager) {
    this.dom = domManager;
    this.navigationManager = navigationManager;
    this.blacklistManager = blacklistManager;
    this.skipTimer = null;
    this.isPaused = false;
    this.progressBarElement = null;
    this.progressBarContainer = null;
    this.pauseIndicatorElement = null;
    const settings = SettingsManager.load();
    this.skipTimeout = settings.autoSkipDelay * 1000;
    this.viewMode = settings.blacklistView; // "skip" | "timeout" | "nothing"
    this.startTime = 0;
    this.enabled = true;
  }

  // Dispatch a blacklisted post according to the configured view mode
  resumeOnBlacklisted() {
    if (this.viewMode === "skip") {
      this.navigationManager.goToNext();
    } else if (this.viewMode === "timeout") {
      this.startAutoSkipCountdown();
    }
  }

  createProgressBar() {
    // Only create if we're on a blacklisted image
    if (!this.blacklistManager.isImageBlacklisted()) {
      return null;
    }

    const navBar = this.dom.getElement("pool.nav");
    if (!navBar) return null;

    // Create container for the progress bar
    const container = document.createElement("div");
    container.className = "pool-nav auto-skip-container";
    container.style.textAlign = "center";
    container.style.display = "block";
    container.style.marginTop = "10px";

    // Add title
    const title = document.createElement("div");
    title.textContent = "Auto-skipping blacklisted image";
    title.style.marginBottom = "5px";
    title.style.fontWeight = "bold";
    container.appendChild(title);

    // Create progress bar container
    const progressBarContainer = document.createElement("div");
    progressBarContainer.style.width = "100%";
    progressBarContainer.style.height = "20px";
    progressBarContainer.style.backgroundColor = "#444";
    progressBarContainer.style.borderRadius = "3px";
    progressBarContainer.style.overflow = "hidden";

    // Create the progress bar (starts full)
    this.progressBarElement = document.createElement("div");
    this.progressBarElement.style.height = "100%";
    this.progressBarElement.style.width = "100%";
    this.progressBarElement.style.backgroundColor = "#ff0000"; // Red progress bar
    this.progressBarElement.style.transition = "width 0.1s linear";
    this.progressBarElement.style.float = "right"; // Right-to-left effect

    progressBarContainer.appendChild(this.progressBarElement);
    container.appendChild(progressBarContainer);

    // Create pause indicator
    this.pauseIndicatorElement = document.createElement("div");
    this.pauseIndicatorElement.style.marginTop = "5px";
    this.pauseIndicatorElement.style.fontSize = "12px";
    this.pauseIndicatorElement.textContent = "Press P to pause";
    container.appendChild(this.pauseIndicatorElement);

    // Append container after the pool ID button
    navBar.appendChild(container);

    this.progressBarContainer = container;
    return container;
  }

  updateProgressBar(secondsRemaining) {
    if (this.progressBarElement) {
      // Convert remaining seconds to percentage (from 100% to 0%)
      const percentRemaining = (secondsRemaining / this.skipTimeout) * 100;
      this.progressBarElement.style.width = `${percentRemaining}%`;
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.pauseIndicatorElement) {
      this.pauseIndicatorElement.textContent = this.isPaused
        ? "Paused (Press P to resume)"
        : "Press P to pause";
    }
  }

  toggle() {
    this.enabled = !this.enabled;

    // If disabled while running, clear any active timer and remove progress bar
    if (!this.enabled && this.skipTimer) {
      clearInterval(this.skipTimer);
      this.skipTimer = null;

      if (this.progressBarContainer && this.progressBarContainer.parentNode) {
        this.progressBarContainer.parentNode.removeChild(
          this.progressBarContainer,
        );
        this.progressBarContainer = null;
      }
    } else if (this.enabled && this.blacklistManager.isImageBlacklisted()) {
      // If we're enabling and on a blacklisted image, start the skip
      this.resumeOnBlacklisted();
    }

    // Show a notification about the state change
    const status = this.enabled ? "enabled" : "disabled";
    this.showNotification(`Auto-skip ${status}`);
  }

  showNotification(message) {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.style.position = "fixed";
    notification.style.top = "10px";
    notification.style.left = "50%";
    notification.style.transform = "translateX(-50%)";
    notification.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    notification.style.color = "white";
    notification.style.padding = "10px 20px";
    notification.style.borderRadius = "5px";
    notification.style.zIndex = "10000";

    document.body.appendChild(notification);

    // Remove notification after 2 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2000);
  }

  startAutoSkipCountdown() {
    // If auto-skip is disabled or already a timer running, don't start
    if (!this.enabled || this.skipTimer) return;

    // Only create and start timer if we're on a blacklisted image
    if (!this.blacklistManager.isImageBlacklisted()) return;

    // Make sure we have a progress bar
    if (!this.progressBarContainer) {
      this.createProgressBar();
    }

    // Reset state
    this.isPaused = false;
    if (this.pauseIndicatorElement) {
      this.pauseIndicatorElement.textContent = "Press P to pause";
    }

    this.startTime = Date.now();

    this.skipTimer = setInterval(() => {
      if (!this.isPaused) {
        const elapsed = Date.now() - this.startTime;
        const remainingTime = Math.max(this.skipTimeout - elapsed, 0);

        this.updateProgressBar(remainingTime);

        if (elapsed >= this.skipTimeout) {
          clearInterval(this.skipTimer);
          this.skipTimer = null;

          // Remove the progress bar container
          if (
            this.progressBarContainer &&
            this.progressBarContainer.parentNode
          ) {
            this.progressBarContainer.parentNode.removeChild(
              this.progressBarContainer,
            );
            this.progressBarContainer = null;
          }

          // Navigate to next post
          this.navigationManager.goToNext();
        }
      }
    }, 50); // Update every 50ms for smooth animation
  }

  checkAndStartSkip() {
    // Check if current image is blacklisted and start timer if needed
    if (this.blacklistManager.isImageBlacklisted() && this.enabled) {
      // Clean up any existing progress bar
      if (this.progressBarContainer && this.progressBarContainer.parentNode) {
        this.progressBarContainer.parentNode.removeChild(
          this.progressBarContainer,
        );
        this.progressBarContainer = null;
      }

      // Clear any existing timer
      if (this.skipTimer) {
        clearInterval(this.skipTimer);
        this.skipTimer = null;
      }

      // Start a fresh countdown
      this.resumeOnBlacklisted();
    } else if (
      !this.blacklistManager.isImageBlacklisted() &&
      this.progressBarContainer
    ) {
      // If we're not on a blacklisted image but have a progress bar, remove it
      if (this.progressBarContainer.parentNode) {
        this.progressBarContainer.parentNode.removeChild(
          this.progressBarContainer,
        );
        this.progressBarContainer = null;
      }

      // Clear any existing timer
      if (this.skipTimer) {
        clearInterval(this.skipTimer);
        this.skipTimer = null;
      }
    }
  }
}

// Shortcut Manager
class ShortcutManager {
  constructor(
    voteManager,
    navigationManager,
    blacklistManager,
    userActions,
    autoSkipManager,
  ) {
    this.voteManager = voteManager;
    this.navigationManager = navigationManager;
    this.blacklistManager = blacklistManager;
    this.userActions = userActions;
    this.autoSkipManager = autoSkipManager;
    this.initializeShortcuts();
  }

  initializeShortcuts() {
    document.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  async handleKeydown(event) {
    // Handle shortcuts based on configuration
    const shortcuts = CONFIG.shortcuts;
    const { code, shiftKey, ctrlKey, altKey } = event;

    // Allow to switch pages even if an interactive element is focused
    if (altKey && code === shortcuts.NEXT_POST.key) {
      this.navigationManager.goToNext();
    } else if (altKey && code === shortcuts.PREV_POST.key) {
      this.navigationManager.goToPrev();
    }

    if (Utils.isInteractiveElementFocused()) return;

    // Always respect the toggle auto-skip key press
    if (code === shortcuts.TOGGLE_AUTOSKIP.key) {
      // If a skip timer is active, just toggle pause state
      if (this.autoSkipManager.skipTimer) {
        this.autoSkipManager.togglePause();
      } else {
        // Otherwise, toggle the auto-skip feature
        this.autoSkipManager.toggle();
      }
      return;
    }

    // Generic shortcuts
    if (!shiftKey && code === shortcuts.UPVOTE.key) {
      await this.voteManager.upvote();
    } else if (shiftKey && code === shortcuts.DOWNVOTE.key) {
      await this.voteManager.downvote();
    } else if (code === shortcuts.NEXT_POST.key) {
      this.navigationManager.goToNext();
    } else if (code === shortcuts.PREV_POST.key) {
      this.navigationManager.goToPrev();
    } else if (code === shortcuts.TOGGLE_BLACKLIST.key) {
      await this.blacklistManager.toggleBlacklist();
    } else if (code === shortcuts.TOGGLE_FAVORITES.key) {
      this.userActions.ignoreFavoritePosts(shiftKey, ctrlKey);
    } else if (!shiftKey && code === shortcuts.LIKE_AND_FAVORITE.key) {
      await this.voteManager.favorite();
      await this.voteManager.upvote();
    } else if (shiftKey && code === shortcuts.FAVORITE_AND_CONTINUE.key) {
      await this.voteManager.favorite();
      await this.voteManager.upvote();

      this.navigationManager.goToNext();
    }
  }
}

// Site function modifier
class SiteModifier {
  constructor(domManager) {
    this.dom = domManager;
  }

  poolLinkOpenInNewTab() {
    const navBar = this.dom.getElement("pool.nav");
    let poolLink = navBar?.querySelector(CONFIG.selectors.pool.link);

    if (!poolLink) return;

    poolLink.target = "_blank";
  }
  
  openWikiLinksInNewTab() {
    const wikiElements = document.querySelectorAll(CONFIG.selectors.wikiButtons);
    wikiElements.forEach(wikiLink => {
      wikiLink.target = "_blank";
    });
  }
}

// Extension Settings Manager — persists userscript settings in localStorage and
// renders an "Extension" tab on e621's own settings page (/users/settings)
class SettingsManager {
  static STORAGE_KEY = "e621_extension_settings";
  static DEFAULTS = {
    autoSkipDelay: CONFIG.delays.autoSkipDelay,
    blacklistView: "timeout", // "skip" | "timeout" | "nothing"
    blurFilteredPosts: true,
  };

  static load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw
        ? { ...this.DEFAULTS, ...JSON.parse(raw) }
        : { ...this.DEFAULTS };
    } catch {
      return { ...this.DEFAULTS };
    }
  }

  static save(settings) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }

  constructor() {
    this.settings = SettingsManager.load();
    this.section = null;
  }

  initialize() {
    const form = document.querySelector(".settings-layout > form");
    const navList = document.querySelector(".settings-nav-list");
    if (!form || !navList) return;

    this.section = this.injectSection(form);
    this.injectStyles();
    const tabLink = this.injectTabLink(navList);
    this.injectMobileOption();

    // e621 switches its settings sections client-side (clicks never navigate),
    // so coexist with their handler: for our link, swap to our section; for
    // native links, their handler runs and we only make sure our own section
    // is hidden and no longer marked as current
    navList.addEventListener("click", (event) => {
      const link = event.target.closest("a[data-section]");
      if (!link) return;
      if (link.dataset.section === "extension") {
        event.preventDefault();
        this.activate();
      } else {
        this.section.hidden = true;
        tabLink.removeAttribute("aria-current");
      }
    });

    // Direct visits to ?tab=extension land on the server's default section;
    // swap in ours so the deep link works after reloads
    if (new URLSearchParams(window.location.search).get("tab") === "extension") {
      this.activate();
    }
  }

  injectTabLink(navList) {
    const listItem = document.createElement("li");
    const link = document.createElement("a");
    link.dataset.section = "extension";
    link.href = "?tab=extension";
    link.textContent = "Extension";
    listItem.appendChild(link);
    navList.appendChild(listItem);
    return link;
  }

  injectMobileOption() {
    const select = document.querySelector(
      'form.settings-nav-select select[name="tab"]',
    );
    if (!select) return;
    const option = document.createElement("option");
    option.value = "extension";
    option.textContent = "Extension";
    select.appendChild(option);
  }

  injectSection(form) {
    const section = document.createElement("section");
    section.className = "settings-section";
    section.id = "settings-extension";
    section.dataset.section = "extension";
    section.hidden = true;
    section.innerHTML = `
      <settings-group name="auto-skip">Auto-Skip</settings-group>
      <settings-entry class="inline">
        <settings-head><label for="extension-auto-skip-delay">Auto-skip countdown (seconds)</label></settings-head>
        <settings-body><input type="number" id="extension-auto-skip-delay" min="0" max="60" step="1"></settings-body>
        <settings-hint>Seconds to show the countdown before skipping a blacklisted post (0 to 60).</settings-hint>
      </settings-entry>
      <settings-entry>
        <settings-head><label for="extension-blacklist-view">When viewing a blacklisted post</label></settings-head>
        <settings-body>
          <select id="extension-blacklist-view">
            <option value="timeout">Show countdown, then skip</option>
            <option value="skip">Skip directly</option>
            <option value="nothing">Do nothing</option>
          </select>
        </settings-body>
        <settings-hint>How the script handles a post that your filters match when you open it.</settings-hint>
      </settings-entry>
      <settings-group name="posts-view">Posts View</settings-group>
      <settings-entry class="inline">
        <settings-head><label for="extension-blur-filtered">Show filtered posts blurred</label></settings-head>
        <settings-body><input type="checkbox" id="extension-blur-filtered"></settings-body>
        <settings-hint>Blurred previews unblur on hover. When off, e621's default applies and filtered posts are hidden entirely.</settings-hint>
      </settings-entry>
      <settings-entry class="bigtext">
        <settings-hint>All extension settings are stored locally in this browser, not in your e621 account. The Save Settings button saves them along with the site's own settings; changes apply on the next page load.</settings-hint>
      </settings-entry>
    `;
    form.appendChild(section);

    section.querySelector("#extension-auto-skip-delay").value =
      this.settings.autoSkipDelay;
    section.querySelector("#extension-blacklist-view").value =
      this.settings.blacklistView;
    section.querySelector("#extension-blur-filtered").checked =
      this.settings.blurFilteredPosts;

    // the site's own Save Settings button submits this form on every tab; when
    // the Extension tab is visible, that submission persists our fields too
    form.addEventListener("submit", () => {
      if (section.hidden) return;
      this.settings.autoSkipDelay = this.clampTimeout(
        Number(section.querySelector("#extension-auto-skip-delay").value),
      );
      section.querySelector("#extension-auto-skip-delay").value =
        this.settings.autoSkipDelay;
      this.settings.blacklistView = section.querySelector(
        "#extension-blacklist-view",
      ).value;
      this.settings.blurFilteredPosts = section.querySelector(
        "#extension-blur-filtered",
      ).checked;
      SettingsManager.save(this.settings);
    });

    return section;
  }

  clampTimeout(value) {
    if (Number.isNaN(value) || value < 0) return 0;
    return Math.min(value, 60);
  }

  injectStyles() {
    if (document.getElementById("extension-settings-style")) return;
    const style = document.createElement("style");
    style.id = "extension-settings-style";
    style.textContent = `
      /* push the site's Save Settings button below our section; on native tabs
         it already renders after the visible section, so the order changes nothing there */
      .settings-layout > form > settings-submit { order: 1; }
      /* separate the storage-info box from the entry above it */
      #settings-extension settings-entry:last-of-type { margin-top: 0.5rem; }
    `;
    document.head.appendChild(style);
  }

  activate() {
    document
      .querySelectorAll(".settings-layout > form > section.settings-section")
      .forEach((section) => {
        section.hidden = section.dataset.section !== "extension";
      });

    document.querySelectorAll(".settings-nav-list a[data-section]").forEach((link) => {
      if (link.dataset.section === "extension") {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    window.history.replaceState(null, "", "?tab=extension");
  }
}

// Blurred Preview Manager — shows posts hidden by the user's filters as blurred
// previews that unblur on hover, instead of e621's default of hiding them
// entirely in the posts index
class BlurredPreviewManager {
  initialize() {
    if (!SettingsManager.load().blurFilteredPosts) return;
    if (document.getElementById("extension-blur-style")) return;

    const style = document.createElement("style");
    style.id = "extension-blur-style";
    // e621 hides filtered previews with #c-posts #a-index .thumbnail.blacklisted
    // { display: none !important }, hides the preview img itself with
    // article.thumbnail.blacklisted img { visibility: hidden } and shows a
    // "blacklisted" ::before banner on the link. On the post page it collapses
    // #image-container.blacklisted img to 0x0 and paints a banner PNG as its
    // background. The overrides mirror each scope one element deeper to out-rank them.
    style.textContent = `
      #c-posts #a-index article.thumbnail.blacklisted,
      #c-popular article.thumbnail.blacklisted,
      #c-favorites article.thumbnail.blacklisted { display: flex !important; }

      #c-posts #a-index article.thumbnail.blacklisted img,
      #c-popular article.thumbnail.blacklisted img,
      #c-favorites article.thumbnail.blacklisted img { visibility: visible !important; filter: blur(28px) saturate(0.85); transition: filter 0.15s ease; }

      #c-posts #a-index article.thumbnail.blacklisted a.thm-link::before,
      #c-popular article.thumbnail.blacklisted a.thm-link::before,
      #c-favorites article.thumbnail.blacklisted a.thm-link::before { content: none !important; }

      #c-posts #a-index article.thumbnail.blacklisted:hover img,
      #c-popular article.thumbnail.blacklisted:hover img,
      #c-favorites article.thumbnail.blacklisted:hover img,
      #c-posts #a-index article.thumbnail.blacklisted:focus-within img,
      #c-popular article.thumbnail.blacklisted:focus-within img,
      #c-favorites article.thumbnail.blacklisted:focus-within img { filter: none; }

      /* post page: restore the full image instead of the banner-PNG placeholder */
      #c-posts #a-show #image-container.blacklisted img,
      #c-posts #a-show #image-container.blacklisted video {
        width: auto !important; height: auto !important;
        padding: 0 !important;
        background-image: none !important;
        filter: blur(28px) saturate(0.85);
        transition: filter 0.15s ease;
      }

      #c-posts #a-show #image-container.blacklisted:hover img,
      #c-posts #a-show #image-container.blacklisted:hover video,
      #c-posts #a-show #image-container.blacklisted:focus-within img,
      #c-posts #a-show #image-container.blacklisted:focus-within video { filter: none; }

      /* post page: recommended previews use the same banner treatment as the index */
      #c-posts #a-show article.thumbnail.blacklisted img { visibility: visible !important; filter: blur(28px) saturate(0.85); transition: filter 0.15s ease; }
      #c-posts #a-show article.thumbnail.blacklisted a.thm-link::before { content: none !important; }
      #c-posts #a-show article.thumbnail.blacklisted:hover img,
      #c-posts #a-show article.thumbnail.blacklisted:focus-within img { filter: none; }
    `;
    document.head.appendChild(style);
  }
}

// Main App
class App {
  constructor() {
    this.domManager = new DOMManager();
    this.voteManager = new VoteManager(this.domManager);
    this.navigationManager = new NavigationManager(this.domManager);
    this.blacklistManager = new BlacklistManager(this.domManager);
    this.poolManager = new PoolManager(this.domManager);
    this.userActions = new UserActions();
    this.autoSkipManager = new AutoSkipManager(
      this.domManager,
      this.navigationManager,
      this.blacklistManager,
    );
    this.shortcutManager = new ShortcutManager(
      this.voteManager,
      this.navigationManager,
      this.blacklistManager,
      this.userActions,
      this.autoSkipManager,
    );
    this.siteModifier = new SiteModifier(this.domManager);

    // Set up mutation observer to detect page content changes
    this.setupMutationObserver();
  }

  setupMutationObserver() {
    // Only observe the specific container that would indicate a blacklisted image
    const imageContainer = document.querySelector("#image-container");
    if (!imageContainer) return;

    // Create a focused mutation observer that only watches for blacklist class changes
    const observer = new MutationObserver((mutations) => {
      // Only check for actual class changes
      const hasClassChange = mutations.some(
        (mutation) =>
          mutation.type === "attributes" && mutation.attributeName === "class",
      );

      if (hasClassChange) {
        // Check if we're on a blacklisted image and should start the auto-skip
        this.autoSkipManager.checkAndStartSkip();
      }
    });

    // Only observe the specific element and only for class changes
    observer.observe(imageContainer, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also observe for URL changes, which indicate navigation between posts
    let lastUrl = location.href;
    const urlObserver = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Small delay to ensure the page has updated
        setTimeout(() => {
          this.autoSkipManager.checkAndStartSkip();
        }, 100);
      }
    }, 500);
  }

  async initialize() {
    await this.blacklistManager.openBlacklist();
    this.poolManager.addCopyPoolID();
    this.siteModifier.poolLinkOpenInNewTab();
    this.siteModifier.openWikiLinksInNewTab();

    // Create the progress bar if not already created
    this.autoSkipManager.createProgressBar();

    // Check for blacklisted image on initial load
    this.autoSkipManager.checkAndStartSkip();
  }
}

// Initialize the application when the window loads; on the settings page,
// set up the Extension tab instead of the posts-page features
window.addEventListener("load", () => {
  if (window.location.pathname === "/users/settings") {
    new SettingsManager().initialize();
    return;
  }
  if (!window.location.pathname.startsWith("/posts")) return;

  const app = new App();
  app.initialize().catch(console.error);
  new BlurredPreviewManager().initialize();
  console.log("Extended Shortcuts with Auto-Skip loaded :)");
});
