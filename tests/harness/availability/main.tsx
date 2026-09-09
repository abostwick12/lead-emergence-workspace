import "../../../app/globals.css";
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {RecordFields} from "../../../components/executive-bundle/record-fields";
import {emptyExecutiveData,executiveSchemas,type ExecutiveData} from "../../../lib/executive-bundle/contracts";
import {styles} from "../../../components/executive-bundle/common";
function Harness(){
 const [value,setValue]=useState<ExecutiveData>(()=>({...emptyExecutiveData("meeting","2026-09-09"),title:"Fictional planning conversation",
  objective:"Review one fictional next step",timeZone:"UTC",durationMinutes:30,participants:[{name:"Fictional colleague",role:"Reviewer"}]} as ExecutiveData));
 const [pending,setPending]=useState(false),[key,setKey]=useState(0),[submitted,setSubmitted]=useState(0);
 return <main className={styles.workspace} style={{padding:20}}>
  <h1>Isolated Executive component test</h1><p>No account, database, provider or connected API. On-screen state is memory-only; remount is not a saved-record test.</p>
  <form onSubmit={event=>{event.preventDefault();setSubmitted(n=>n+1);}}>
   <RecordFields key={key} value={value} onChange={setValue} onTimePending={setPending}/>
   <p data-testid="pending">{pending?"Unapplied inputs block the meeting save":"No unapplied inputs"}</p>
  </form>
  <p data-testid="submits">{submitted}</p>
  <button type="button" onClick={()=>setKey(n=>n+1)}>Remount current on-screen record</button>
  <p data-testid="valid">{executiveSchemas.meeting.safeParse(value).success?"Valid meeting record":"Invalid meeting record"}</p>
  <pre data-testid="record" className={styles.preview}>{JSON.stringify(value,null,2)}</pre>
 </main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
