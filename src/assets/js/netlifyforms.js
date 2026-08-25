/**
 * Netlify form submission.
 *
 * Without JS the form posts natively and Netlify redirects to the action URL,
 * where the ?sent= param renders the confirmation — so every form works with
 * the script blocked. With JS it posts in place, which keeps scroll position
 * and avoids a reload.
 *
 * Success copy lives on the form as data-success, not in here, so the wording
 * stays with the page it belongs to.
 */

const ERROR = "That did not send. Try again, or email jayden@soldbykennedy.ca directly.";

function note(form) {
  return form.querySelector("[data-form-status]");
}

function showStatus(form, text, state) {
  const el = note(form);
  if (!el) return;

  el.textContent = text;
  el.hidden = false;

  if (state) {
    el.setAttribute("data-state", state);
  } else {
    el.removeAttribute("data-state");
  }
}

function successText(form) {
  return form.getAttribute("data-success") || "Thank you. Your message is with me.";
}

function submit(form) {
  const button = form.querySelector('button[type="submit"]');
  const original = button ? button.textContent : "";

  if (button) {
    button.disabled = true;
    button.textContent = "Sending";
  }

  fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(new FormData(form)).toString(),
  })
    .then((response) => {
      if (!response.ok) throw new Error(response.status);
      form.reset();
      showStatus(form, successText(form));
    })
    .catch(() => {
      showStatus(form, ERROR, "error");
    })
    .then(() => {
      if (!button) return;
      button.disabled = false;
      button.textContent = original;
    });
}

export function initForms(root = document) {
  const forms = root.querySelectorAll("[data-form]");
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!form.checkValidity()) return;
      event.preventDefault();
      submit(form);
    });
  });

  const sent = new URLSearchParams(window.location.search).get("sent");
  if (!sent) return;

  const target = root.querySelector('form[name="' + sent + '"]');
  if (!target) return;

  target.reset();
  showStatus(target, successText(target));
}