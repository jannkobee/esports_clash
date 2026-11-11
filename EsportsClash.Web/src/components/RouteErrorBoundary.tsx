import {Component,type ErrorInfo,type ReactNode} from 'react';

/** Keep a route failure visible and recover when the user navigates to another page. */
export class RouteErrorBoundary extends Component<{children:ReactNode},{error:Error|null}> {
  state:{error:Error|null}={error:null};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error('Page rendering failed',error,info.componentStack);}
  reset=()=>{if(this.state.error)this.setState({error:null});};
  componentDidMount(){window.addEventListener('hashchange',this.reset);}
  componentWillUnmount(){window.removeEventListener('hashchange',this.reset);}
  render(){
    if(!this.state.error)return this.props.children;
    return <section className="fps-lab" style={{padding:24,maxWidth:1000,margin:'auto'}} role="alert"><h1>This page could not open</h1><p>The page encountered a rendering error. Your server records have not been changed.</p><button className="cm-btn" onClick={this.reset}>Try this page again</button><nav className="fps-lab__report-actions"><a href="#hexapedia/fps">Open FPS reference</a><a href="#fps-simulation">Watch a simulation</a><a href="#settings">Settings</a></nav><details><summary>Error details</summary><p>{this.state.error.message}</p></details></section>;
  }
}
