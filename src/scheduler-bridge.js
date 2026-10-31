// Temporary compatibility adapter for SAP template 6 only. It changes the
// confirmation's display copy; the provider's UTC storage and requests stay intact.
(() => {
  if (
    location.hostname !== "schedule.projecthamburg.com" ||
    location.pathname !== "/booking/sap-service-cleanup"
  )
    return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = new URL(
        typeof input === "string" ? input : input.url,
        location.href
      );
      if (
        url.origin !== location.origin ||
        url.pathname !== "/api/booking/submit" ||
        init?.method?.toUpperCase() !== "POST" ||
        !response.ok
      )
        return response;
      const request = JSON.parse(init.body);
      if (
        request.templateId !== 6 ||
        typeof request.bookingDate !== "string" ||
        request.bookingDate.length !== 10 ||
        !/^\d{4}-\d{2}-\d{2}/.test(request.bookingDate)
      )
        return response;
      const data = await response.clone().json();
      if (
        !data.success ||
        !data.booking ||
        typeof data.booking.bookingTime !== "string" ||
        data.booking.bookingTime.length !== 5 ||
        !/^\d{2}:\d{2}/.test(data.booking.bookingTime)
      )
        return response;
      const instant = new Date(
        request.bookingDate + "T" + data.booking.bookingTime + ":00Z"
      );
      const localTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: request.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(instant);
      // Provider uses Date -> browser-local date formatting for a calendar day.
      // A timezone-free local noon preserves that selected day in every browser.
      data.booking.bookingDate = request.bookingDate + "T12:00:00";
      data.booking.bookingTime = localTime;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return response;
    }
  };
})();
