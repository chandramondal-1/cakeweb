(function () {
  const { initNavigation, initReveal, setText, showToast } = window.TVBShared;
  const { siteData } = window.TVBData;
  const { createMessage } = window.TVBStore;

  async function initContactPage() {
    initNavigation();

    const site = siteData;
    setText("[data-brand-name]", site.brand.name);
    setText("[data-brand-tagline]", site.brand.tagline);
    setText("[data-contact-location]", site.brand.location);
    setText("[data-contact-hours]", site.brand.hours);
    setText("[data-contact-phone]", site.brand.phoneDisplay);

    document.querySelectorAll("[data-maps-link]").forEach((node) => {
      node.href = site.brand.mapsUrl;
    });

    document.querySelectorAll("[data-phone-link]").forEach((node) => {
      node.href = `tel:+${site.brand.phoneRaw}`;
    });

    const form = document.querySelector("[data-contact-form]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        customerName: form.customerName.value,
        phone: form.phone.value,
        email: form.email.value,
        subject: form.subject.value,
        message: form.message.value
      };

      const button = form.querySelector("[type='submit']");
      button.disabled = true;
      button.textContent = "Sending...";

      try {
        await createMessage(payload);
        form.reset();
        showToast("Message sent successfully.");
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
        button.textContent = "Send enquiry";
      }
    });

    initReveal();
  }

  initContactPage().catch((error) => {
    console.error(error);
  });
})();
