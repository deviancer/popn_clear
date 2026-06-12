const params = new URLSearchParams(window.location.search);
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const title = document.querySelector("#confirm-title");
const copy = document.querySelector("#confirm-copy");

const error = params.get("error_description") || hashParams.get("error_description") || params.get("error") || hashParams.get("error");

if (error) {
  title.textContent = "确认链接不可用";
  copy.textContent = `邮箱确认没有完成：${error}`;
} else if (window.location.hash) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
