/**
 * This is the top-level entry point for the demo application
 **/

import _ from 'lodash';
import $log from 'hlog';
import good from './nested-folder/good-organization-stuff.js';

class MyDemoApplication{
    constructor(){
        let myVal = "The value is set";
        $log.info("MyDemoApplication constructor was called.", myVal);
    }

    doSomethingWithJustJS() {
        $log.info("Doing someting with just JS!");
        let myEl = document.querySelector(".put-your-classes-here");
        myEl.innerHTML = "If you are reading this then the demo works!";
	    good.doStuff();
    }
}

$log.info("ES6 bootstrapper loaded!");

let myApp = new MyDemoApplication();

setTimeout( () => {
    myApp.doSomethingWithJustJS();
}, 200);