import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Chart } from "@/components/ui/chart";

describe("Chart", () => {
  it("handles zero-value datasets without NaN outputs", () => {
    const { container } = render(
      <Chart
        data={[
          { label: "A", value: 0 },
          { label: "B", value: 0 },
        ]}
        type="bar"
      />,
    );

    expect(container.innerHTML).not.toContain("NaN");
  });

  it("renders fallback message when no data is provided", () => {
    const { queryByText } = render(<Chart data={[]} />);

    expect(queryByText("Nenhum dado disponível")).not.toBeNull();
  });
});
