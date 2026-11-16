/**
 * 全屏管理/设置视图时切换 html、body 的 bh-manage-mode，撑满 popup 视口。
 */
export function setManageMode(on: boolean) {
  document.documentElement.classList.toggle("bh-manage-mode", on);
  document.body.classList.toggle("bh-manage-mode", on);
}