import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useNavigate } from "react-router-dom";

/**
 * Listens for native deep links of the form `playeranalysis://capture/<token>`
 * and navigates the in-app router to the matching capture screen.
 *
 * Must be mounted INSIDE <BrowserRouter> because it uses `useNavigate`.
 */
export const useDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handlerPromise = App.addListener("appUrlOpen", (event) => {
      const url = event?.url ?? "";
      if (url.startsWith("playeranalysis://capture/")) {
        const token = url.split("capture/")[1]?.split(/[?#]/)[0];
        if (token) {
          navigate(`/capture/${token}`);
        }
      } else if (url.startsWith("playeranalysis://my-recordings")) {
        // Optional ?match=<id> filter
        const q = url.split("?")[1] || "";
        navigate(`/my-recordings${q ? `?${q}` : ""}`);
      }
    });

    return () => {
      handlerPromise.then((sub) => sub.remove()).catch(() => {});
    };
  }, [navigate]);
};