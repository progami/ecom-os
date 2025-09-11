declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R;
    }
    
    interface Expect {
      toBeWithinRange(min: number, max: number): any;
    }
  }
}

export {};