import type { ReactNode } from "react";

function inline(text:string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|`[^`]+`)/g);
  return tokens.map((token,index)=>{
    if(token.startsWith("**")&&token.endsWith("**"))return <strong key={index}>{token.slice(2,-2)}</strong>;
    if(token.startsWith("*")&&token.endsWith("*"))return <em key={index}>{token.slice(1,-1)}</em>;
    if(token.startsWith("`")&&token.endsWith("`"))return <code key={index}>{token.slice(1,-1)}</code>;
    const link=token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if(link)return <a href={link[2]} target="_blank" rel="noreferrer noopener" key={index}>{link[1]}</a>;
    return token;
  });
}
export default function NoteMarkdown({body}:{body:string}){
  const lines=body.split(/\r?\n/);
  if(!body.trim())return <p className="fox-md-placeholder">Добавьте текст в режиме редактирования.</p>;
  return <div className="fox-note-markdown">{lines.map((line,index)=>{
    if(/^###\s/.test(line))return <h3 key={index}>{inline(line.slice(4))}</h3>;
    if(/^##\s/.test(line))return <h2 key={index}>{inline(line.slice(3))}</h2>;
    if(/^#\s/.test(line))return <h1 key={index}>{inline(line.slice(2))}</h1>;
    if(/^\s*[-*]\s+\[[xX ]\]\s/.test(line)){
      const done=/^\s*[-*]\s+\[[xX]\]/.test(line);
      return <div className="fox-md-check" key={index}><input type="checkbox" checked={done} readOnly/><span>{inline(line.replace(/^\s*[-*]\s+\[[xX ]\]\s/,""))}</span></div>;
    }
    if(/^\s*[-*]\s/.test(line))return <div className="fox-md-bullet" key={index}><span>•</span><span>{inline(line.replace(/^\s*[-*]\s/,""))}</span></div>;
    if(/^\s*\d+\.\s/.test(line))return <div className="fox-md-bullet" key={index}><span>{line.trim().match(/^\d+/)?.[0]}.</span><span>{inline(line.replace(/^\s*\d+\.\s/,""))}</span></div>;
    if(/^>\s?/.test(line))return <blockquote key={index}>{inline(line.replace(/^>\s?/,""))}</blockquote>;
    if(/^---+$/.test(line.trim()))return <hr key={index}/>;
    return <p key={index}>{inline(line)||"\u00a0"}</p>;
  })}</div>;
}
