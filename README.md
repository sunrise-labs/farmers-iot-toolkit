# Farmers IoT Toolkit

A practical, open-source toolkit that shows farmers how to build and deploy
their own IoT (Internet of Things) solutions using low-cost parts and
microcontrollers.

No expensive companies. No complicated jargon. Just simple, step-by-step
guides that any farmer can follow.


## Background

This project was submitted as a [full funding proposal](proposal/) to
[Float](https://float.ag) — a community-led funding lab for open
agroecological technologies. Float selected it as a **discovery proposal**
rather than a full proposal, so we are developing the toolkit incrementally
and documenting as we go.


## The Toolkit

The toolkit starts with four core modules. Each one solves a real problem on
the farm. They work on their own, but they can also be combined into a single,
fully operational IoT system.

![Farmers IoT Toolkit — 4 Modules](images/Farmers%20IoT%20Toolkit.png)

| # | Module | Difficulty | What it does |
|---|--------|------------|-------------|
| 1 | [Water Tank Level Sensor](docs/01-water-tank-level-sensor.md) | Beginner | Measures how full your water tank is and sends the reading to your phone |
| 2 | [Soil Moisture Sensor to Drip Irrigation](docs/02-soil-moisture-drip-irrigation.md) | Advanced | Checks soil moisture and automatically opens/closes an irrigation valve |
| 3 | [IoT Solar Powerbank](docs/03-iot-solar-powerbank.md) | Medium | Off-grid solar power supply for your sensors and devices |
| 4 | [Mobile WiFi Base Station](docs/04-mobile-wifi-base-station.md) | Beginner | An Android phone that collects sensor data over WiFi and connects to the internet |


## The website

The toolkit's public site lives in [`site/`](site/) — hero, the four modules and how they
interact, a video summary, the [full wiring cheatsheet](site/src/pages/cheatsheet.ts), and a
deep-dive page per module with wiring diagrams, a BOM with buy links, and a step-by-step build
walkthrough.

```bash
bun site/build.ts --serve     # http://localhost:4321
```

It is plain static HTML with no framework and no third-party requests, and every wiring table,
pin map and BOM row is generated from one typed source (`site/src/data.ts`) so the site cannot
drift from the firmware the way the prose docs once did. See [`site/README.md`](site/README.md).


## Who is this for?

- Farmers who want to use technology but do not want to depend on expensive providers
- People with little or no experience in electronics or programming
- Communities in remote areas with limited access to technical support
- Young people interested in technology who want to apply it to agriculture


## Status

This project is in early development. Each module doc is a working template
that will be filled in with wiring diagrams, photos, code, and video tutorials
as the builds progress.


## License

Open source — use, share, and adapt freely.


## Project

Built by [Sunrise Labs](https://sunriselabs.io) (Mauke, Cook Islands)
