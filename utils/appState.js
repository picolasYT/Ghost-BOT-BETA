const appState = global.ghostBotAppState || (global.ghostBotAppState = {
  startedAt: Date.now(),
  bot: {
    status: "starting",
    provider: "",
    commands: 0,
    authPath: "",
    ownerName: "",
    botName: "",
    platform: "",
    node: ""
  }
});

export function getAppState() {
  return {
    ...appState,
    bot: { ...appState.bot }
  };
}

export function patchBotState(patch = {}) {
  Object.assign(appState.bot, patch);
}
