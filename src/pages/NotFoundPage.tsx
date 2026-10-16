import { Link } from "react-router";
import { buttonClass } from "@/components/ui";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-6">
      <p className="text-[15px] text-muted">This page doesn’t exist.</p>
      <Link to="/rides" className={buttonClass("secondary")}>
        Go to Rides
      </Link>
    </div>
  );
}
