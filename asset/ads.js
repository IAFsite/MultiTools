// IAF MultiTools - Advertisement Loader

const ads = [
    "https://multitools.indoadvfuture.com/asset/ads.gif"
];

function loadAds() {
    const adSlots = document.querySelectorAll(".ad-slot");

    adSlots.forEach(slot => {
        const randomAd = ads[Math.floor(Math.random() * ads.length)];

        const image = document.createElement("img");
        image.src = randomAd;
        image.alt = "Advertisement";
        image.loading = "lazy";

        slot.innerHTML = "";
        slot.appendChild(image);
    });
}

document.addEventListener("DOMContentLoaded", loadAds);