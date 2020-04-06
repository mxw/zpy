import * as React from 'react'
import axios from 'axios'

import {Session} from "../context.ts"

export const SessionProvider = (props: {children: JSX.Element[] | JSX.Element}) => {

  let [value, setValue] = React.useState<string | null>(null);

  if (value === null) {
    axios.get('/api/session')
         .then(response => {
           setValue(response.data);
         });
  }

  return <Session.Provider value={value}> {props.children} </Session.Provider>;
}
