import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DonutChart from "@/components/DonutChart.vue";

describe("DonutChart", () => {
  it("affiche le total dans le centre", () => {
    const wrapper = mount(DonutChart, {
      props: {
        segments: [
          { label: "Alimentation", value: 45, color: "#ffa94d" },
          { label: "Transport", value: 15, color: "#6ea8fe" },
        ],
      },
    });
    expect(wrapper.text()).toContain("60");
  });

  it("liste chaque segment dans la légende", () => {
    const wrapper = mount(DonutChart, {
      props: {
        segments: [
          { label: "Alimentation", value: 45, color: "#ffa94d" },
          { label: "Transport", value: 15, color: "#6ea8fe" },
        ],
      },
    });
    const items = wrapper.findAll(".donut-legend li");
    expect(items).toHaveLength(2);
    expect(wrapper.text()).toContain("Alimentation");
    expect(wrapper.text()).toContain("Transport");
  });

  it("n'affiche aucun arc et montre le message vide quand il n'y a pas de données", () => {
    const wrapper = mount(DonutChart, { props: { segments: [] } });
    expect(wrapper.findAll("circle[stroke-dasharray]")).toHaveLength(0);
    expect(wrapper.text()).toContain("Aucune donnée");
  });

  it("ignore les segments à zéro (pas d'arc de longueur nulle)", () => {
    const wrapper = mount(DonutChart, {
      props: {
        segments: [
          { label: "A", value: 10, color: "#fff" },
          { label: "B", value: 0, color: "#000" },
        ],
      },
    });
    expect(wrapper.findAll("circle[stroke-dasharray]")).toHaveLength(1);
  });
});
