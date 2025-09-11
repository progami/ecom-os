// Type declarations for jspdf-autotable
declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  
  interface AutoTableOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: any;
    styles?: any;
    margin?: any;
    didDrawPage?: (data: any) => void;
    showHead?: boolean;
  }
  
  interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: AutoTableOptions) => void;
    lastAutoTable: {
      finalY: number;
    };
  }
  
  export function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}