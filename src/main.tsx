import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { initDesktopLinks } from "./features/desktop/integration";
import { initializePersistentStorage } from "./features/storage/persistence";

const root=ReactDOM.createRoot(document.getElementById("root")!);

async function mount(){
  try{
    await initializePersistentStorage();
    root.render(<React.StrictMode><App /></React.StrictMode>);
  }catch(error){
    console.error("Fox Space storage initialization failed",error);
    root.render(<main className="fox-storage-error">
      <h1>Не удалось открыть рабочее пространство</h1>
      <p>{error instanceof Error?error.message:String(error)}</p>
      <button className="primary-button" onClick={()=>void mount()}>Повторить</button>
    </main>);
  }
}

initDesktopLinks();
void mount();
