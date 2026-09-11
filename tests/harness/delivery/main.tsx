import "../../../app/globals.css";
import {createRoot} from "react-dom/client";
import {ExecutiveDeliverySchedules} from "../../../components/executive-bundle/delivery-schedules";
import {styles} from "../../../components/executive-bundle/common";
import {simulateDue} from "./mock-use-executive";
function Harness(){return <main className={styles.workspace} style={{padding:20}}><h1>Isolated Executive delivery component</h1><p className={styles.notice}>Interaction and layout simulation only. No account, database, provider, background runner or API is connected.</p><ExecutiveDeliverySchedules capability="executive.brief" availableKinds={["daily_brief","weekly_review"]}/><button type="button" onClick={simulateDue}>Simulate one due occurrence</button></main>;}
createRoot(document.getElementById("root")!).render(<Harness/>);
