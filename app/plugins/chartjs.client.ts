import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from "chart.js";

// Register only the pieces the overview bar chart uses. Client-only — the
// chart renders to a <canvas> in the browser, never on the server.
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

export default defineNuxtPlugin(() => {});
