import { SheetScreen } from "../../components/Sheet";
import { SourcesList } from "../sources";

/** Sources inside the sheet (IA stress test, 15 Oct 2026): pushed here, ‹ back to the page it came from. */
export default function Page() {
  return (
    <SheetScreen title="Sources and licences" backLabel={null} footer={false} testID="sources-sheet">
      <SourcesList />
    </SheetScreen>
  );
}
