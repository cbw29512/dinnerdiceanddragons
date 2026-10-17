(() => {
  "use strict";

  const rt = window.DDDGameHubRuntime;

  function render(items) {
    try {
      const list = rt.byId("hub-announcements");
      if (!list) return;
      list.replaceChildren();
      if (!items.length) {
        rt.appendEmpty(list, "No DM announcements yet.");
        return;
      }
      for (const item of items) {
        const article = document.createElement("article");
        article.className = "hub-announcement-item";
        const body = document.createElement("p");
        body.textContent = item.body;
        const meta = document.createElement("p");
        meta.className = "hub-muted";
        meta.textContent = `DM announcement · ${rt.formatDateTime(item.created_at)}`;
        article.append(body, meta);
        list.append(article);
      }
    } catch (error) {
      console.error("[DDD Game Hub] Unable to render announcements", error);
    }
  }

  async function load() {
    try {
      if (!rt.state.eventId) return;
      render(await window.DDDProductionAPI.getAnnouncements(rt.state.eventId));
    } catch (error) {
      console.error("[DDD Game Hub] Unable to load announcements", error);
      rt.setStatus("Announcements could not be loaded.", "error");
    }
  }

  async function post(form) {
    try {
      const input = form.querySelector('textarea[name="body"]');
      const body = String(input?.value || "").trim();
      if (!body) {
        input?.focus();
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      await window.DDDProductionAPI.postAnnouncement(rt.state.eventId, body);
      form.reset();
      await load();
      rt.setStatus("Announcement posted.", "success");
      if (button) button.disabled = false;
    } catch (error) {
      console.error("[DDD Game Hub] Unable to post announcement", error);
      rt.setStatus(error?.message || "Announcement could not be posted.", "error");
      form.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    }
  }

  function bind() {
    try {
      const form = rt.byId("hub-announcement-form");
      if (!form) return;
      const canPost = Boolean(rt.state.hub?.capabilities?.can_post_announcement);
      form.hidden = !canPost;
      form.onsubmit = canPost ? (event) => { event.preventDefault(); void post(form); } : null;
    } catch (error) {
      console.error("[DDD Game Hub] Unable to bind announcement controls", error);
    }
  }

  window.DDDGameHubAnnouncements = Object.freeze({ bind, load, render });
})();
