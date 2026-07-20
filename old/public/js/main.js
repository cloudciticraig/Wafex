/* Wafex — site behaviour */
(function () {
  "use strict";

  /* Mobile navigation */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("mobile-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Scroll reveals */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* Drifting waxflower petals in hero */
  var petalHost = document.querySelector("[data-petals]");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (petalHost && !reduced) {
    var PETAL =
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M12 2C15 6 16.5 10 12 14 7.5 10 9 6 12 2Z" fill="currentColor" opacity="0.85"/>' +
      '<circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>';
    var colors = ["#e8a7b6", "#c9536f", "#d9a441", "#8fae97"];
    var count = window.innerWidth < 700 ? 6 : 12;
    for (var i = 0; i < count; i++) {
      var p = document.createElement("span");
      p.className = "petal";
      p.innerHTML = PETAL;
      var size = 10 + Math.random() * 16;
      p.style.width = size + "px";
      p.style.height = size + "px";
      p.style.left = Math.random() * 100 + "%";
      p.style.top = "-4vh";
      p.style.color = colors[i % colors.length];
      p.style.setProperty("--dur", 12 + Math.random() * 14 + "s");
      p.style.setProperty("--dx", (Math.random() * 160 - 80).toFixed(0) + "px");
      p.style.setProperty("--rot", (180 + Math.random() * 360).toFixed(0) + "deg");
      p.style.animationDelay = (Math.random() * 14).toFixed(1) + "s";
      petalHost.appendChild(p);
    }
  }

  /* Bloom calendar — build from data attributes */
  var cal = document.querySelector("[data-bloom]");
  if (cal) {
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var rows = [
      { name: "Waxflower (Helix\u2122)", on: [5,6,7,8,9,10,11,12], peak: [7,8,9] },
      { name: "Protea",                 on: [1,2,3,4,5,6,7,8,9,10,11], peak: [3,4,5,6] },
      { name: "Banksia",                on: [1,2,3,4,5,6,7,8,9,10,11,12], peak: [2,3,4,5] },
      { name: "Kangaroo Paw",           on: [1,2,8,9,10,11,12], peak: [10,11] },
      { name: "Leucadendron",           on: [3,4,5,6,7,8,9,10], peak: [5,6,7] },
      { name: "Ecuadorian Roses",       on: [1,2,3,4,5,6,7,8,9,10,11,12], peak: [1,2] },
      { name: "Kenyan Summer Flowers",  on: [1,2,3,4,5,6,7,8,9,10,11,12], peak: [9,10,11] },
      { name: "Dried & Preserved",      on: [1,2,3,4,5,6,7,8,9,10,11,12], peak: [] }
    ];
    var html = '<table><caption class="sr-only">Indicative flower availability by month</caption><thead><tr><th scope="col">Variety</th>';
    months.forEach(function (m) { html += '<th scope="col">' + m + "</th>"; });
    html += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      html += '<tr><th scope="row">' + r.name + "</th>";
      for (var m = 1; m <= 12; m++) {
        var cls = r.peak.indexOf(m) > -1 ? "dot peak" : r.on.indexOf(m) > -1 ? "dot on" : "dot";
        var label = r.peak.indexOf(m) > -1 ? "Peak season" : r.on.indexOf(m) > -1 ? "Available" : "Out of season";
        html += '<td><span class="' + cls + '" role="img" aria-label="' + months[m-1] + ": " + label + '"></span></td>';
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    cal.innerHTML = html;
  }

  /* Contact form — client-side demo handler */
  var form = document.getElementById("enquiry-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var name = (document.getElementById("f-name") || {}).value || "";
      var success = document.getElementById("form-success");
      form.hidden = true;
      if (success) {
        success.hidden = false;
        success.querySelector("[data-name]").textContent = name.split(" ")[0] || "there";
        success.focus();
      }
    });
  }

  /* Footer year */
  var yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
