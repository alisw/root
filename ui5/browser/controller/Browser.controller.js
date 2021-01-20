sap.ui.define(['sap/ui/core/mvc/Controller',
               'sap/m/Link',
               'sap/ui/core/Fragment',
               'rootui5/browser/model/BrowserModel',
               'sap/ui/model/json/JSONModel',
               'sap/ui/table/Column',
               'sap/ui/layout/HorizontalLayout',
               'sap/m/TabContainerItem',
               'sap/m/MessageToast',
               'sap/m/MessageBox',
               'sap/m/Text',
               'sap/ui/core/mvc/XMLView',
               'sap/ui/core/Icon',
               'sap/m/Button',
               'sap/ui/codeeditor/CodeEditor',
               'sap/m/Image',
               'sap/tnt/ToolHeader',
               'sap/m/ToolbarSpacer',
               'sap/m/OverflowToolbarLayoutData',
               'rootui5/browser/controller/FileDialog.controller'
],function(Controller,
           Link,
           Fragment,
           BrowserModel,
           JSONModel,
           tableColumn,
           HorizontalLayout,
           TabContainerItem,
           MessageToast,
           MessageBox,
           mText,
           XMLView,
           CoreIcon,
           Button,
           CodeEditor,
           Image,
           ToolHeader,
           ToolbarSpacer,
           OverflowToolbarLayoutData,
           FileDialogController) {

   "use strict";

   /** Central ROOT RBrowser controller
    * All Browser functionality is loaded after main ui5 rendering is performed */

   return Controller.extend("rootui5.browser.controller.Browser", {
      onInit: async function () {

         let pthis = this;
         let burgerMenu = pthis.getView().byId("burgerMenu");

         sap.ui.Device.orientation.attachHandler((mParams) => {
            burgerMenu.detachPress(pthis.onFullScreenPressLandscape, pthis);
            burgerMenu.detachPress(pthis.onFullScreenPressPortrait, pthis);

            if (mParams.landscape) {
               burgerMenu.attachPress(pthis.onFullScreenPressLandscape, pthis);
               this.getView().byId('expandMaster').setVisible(true);
            } else {
               burgerMenu.attachPress(pthis.onFullScreenPressPortrait, pthis);

               this.getView().byId('masterPage').getParent().removeStyleClass('masterExpanded');
               this.getView().byId('expandMaster').setVisible(false);
               this.getView().byId('shrinkMaster').setVisible(false);
            }
         });

         if(sap.ui.Device.orientation.landscape) {
            burgerMenu.attachPress(pthis.onFullScreenPressLandscape, pthis);
         } else {
            burgerMenu.attachPress(pthis.onFullScreenPressPortrait, pthis);
            this.getView().byId('expandMaster').setVisible(false);
         }

        this.globalId = 1;
        this.nextElem = "";

        this._oSettingsModel = new JSONModel({
            SortMethods: [
               { name: "name", value: "name" },
               { name: "size", value: "size" },
               { name: "none", value: "" }
            ],
            SortMethod: "name",
            ReverseOrder: false,
            ShowHiddenFiles: false,
            DBLCLKRun: false,
            TH1: [
               {name: "hist"},
               {name: "P"},
               {name: "P0"},
               {name: "E"},
               {name: "E1"},
               {name: "E2"},
               {name: "E3"},
               {name: "E4"},
               {name: "E1X0"},
               {name: "L"},
               {name: "LF2"},
               {name: "B"},
               {name: "B1"},
               {name: "A"},
               {name: "TEXT"},
               {name: "LEGO"},
               {name: "same"}
            ],
            TH2: [
               {name: "COL"},
               {name: "COLZ"},
               {name: "COL0"},
               {name: "COL1"},
               {name: "COL0Z"},
               {name: "COL1Z"},
               {name: "COLA"},
               {name: "BOX"},
               {name: "BOX1"},
               {name: "PROJ"},
               {name: "PROJX1"},
               {name: "PROJX2"},
               {name: "PROJX3"},
               {name: "PROJY1"},
               {name: "PROJY2"},
               {name: "PROJY3"},
               {name: "SCAT"},
               {name: "TEXT"},
               {name: "TEXTE"},
               {name: "TEXTE0"},
               {name: "CONT"},
               {name: "CONT1"},
               {name: "CONT2"},
               {name: "CONT3"},
               {name: "CONT4"},
               {name: "ARR"},
               {name: "SURF"},
               {name: "SURF1"},
               {name: "SURF2"},
               {name: "SURF4"},
               {name: "SURF6"},
               {name: "E"},
               {name: "A"},
               {name: "LEGO"},
               {name: "LEGO0"},
               {name: "LEGO1"},
               {name: "LEGO2"},
               {name: "LEGO3"},
               {name: "LEGO4"},
               {name: "same"}
            ],
            TProfile: [
               {name: "E0"},
               {name: "E1"},
               {name: "E2"},
               {name: "p"},
               {name: "AH"},
               {name: "hist"}
            ]
         });

        this.websocket = this.getView().getViewData().conn_handle;

         // this is code for the Components.js
         // this.websocket = Component.getOwnerComponentFor(this.getView()).getComponentData().conn_handle;

         this.websocket.setReceiver(this);
         this.websocket.connect();

         // if true, most operations are performed locally without involving server
         this.standalone = this.websocket.kind == "file";

         // create model only for browser - no need for anybody else
         this.model = new BrowserModel();

         // copy extra attributes from element to node in the browser
         // later can be done automatically
         this.model.addNodeAttributes = function(node, elem) {
            node.icon = elem.icon;
            node.fsize = elem.fsize;
            node.mtime = elem.mtime;
            node.ftype = elem.ftype;
            node.fuid = elem.fuid;
            node.fgid = elem.fgid;
            node.className = elem.className
         };

         var t = this.getView().byId("treeTable");
         t.setModel(this.model);

         this.model.assignTreeTable(t);
         t.addColumn(new tableColumn({
            label: "Name",
            autoResizable: true,
            visible: true,
            template: new HorizontalLayout({
               content: [
                         new CoreIcon({src:"{icon}"}),
                         new mText({text:" {name}", renderWhitespace: true, wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "Size",
            autoResizable: true,
            visible: true,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{fsize}", wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "Time",
            autoResizable: true,
            visible: false,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{mtime}", wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "Type",
            autoResizable: true,
            visible: false,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{ftype}", wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "UID",
            autoResizable: true,
            visible: false,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{fuid}", wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "GID",
            autoResizable: true,
            visible: false,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{fgid}", wrapping: false })
                         ]
            })
         }));
         t.addColumn(new tableColumn({
            label: "ClassName",
            autoResizable: true,
            visible: false,
            template: new HorizontalLayout({
               content: [
                         new mText({text:"{className}", wrapping: false })
                         ]
            })
         }));

         // catch re-rendering of the table to assign handlers
         t.addEventDelegate({
            onAfterRendering: function() { this.assignRowHandlers(); }
         }, this);

         this.drawingOptions = { TH1: 'hist', TH2: 'COL', TProfile: 'E0'};
      },

      createImageViewer: function (name, title) {
         let oTabContainer = this.getView().byId("tabContainer");

         let image = new Image(name+ "Image", { src: "", densityAware: false });
         image.addStyleClass("imageViewer");

         let item = new TabContainerItem(name, {
            icon: "sap-icon://background",
            name: "Image Viewer",
            key: name,
            additionalText: title,
            content: new sap.m.Page({
               showNavButton: false,
               showFooter: false,
               showSubHeader: false,
               showHeader: false,
               content: image
            })
         });

         oTabContainer.addItem(item);
         oTabContainer.setSelectedItem(item);
      },

      /* =========================================== */
      /* =============== Code Editor =============== */
      /* =========================================== */

      createCodeEditor: function(name, title) {
         const oTabContainer = this.getView().byId("tabContainer");

         let item = new TabContainerItem(name, {
            icon: "sap-icon://write-new-document",
            name: "Code Editor",
            key: name,
            additionalText: title,
            content: this.newCodeEditorFragment(name)
         });

         item.setModel(new JSONModel({
            code: "",
            ext: "",
            filename: "",
            fullpath: "",
            modified: false,
            runEnabled: false,
            saveEnabled: false
         }));

         oTabContainer.addItem(item);
         oTabContainer.setSelectedItem(item);
      },

      newCodeEditorFragment: function (ID) {
         console.log("Create edtitor with id", ID + "Editor");
         return [
               new ToolHeader({
                  height: "40px",
                  content: [
                     new Button(ID + "Run", {
                        text: "Run",
                        tooltip: "Run Current Macro",
                        icon: "sap-icon://play",
                        type: "Transparent",
                        enabled: "{/runEnabled}",
                        press: [this.onRunMacro, this]
                     }),
                     new ToolbarSpacer({
                        layoutData: new OverflowToolbarLayoutData({
                           priority:"NeverOverflow",
                           minWidth: "16px"
                        })
                     }),
                     new Button(ID + "SaveAs", {
                        text: "Save as...",
                        tooltip: "Save current file as...",
                        type: "Transparent",
                        press: [this.onSaveAs, this]
                     }),
                     new Button(ID + "Save", {
                        text: "Save",
                        tooltip: "Save current file",
                        type: "Transparent",
                        enabled: "{/saveEnabled}",
                        press: [this.onSaveFile, this]
                     })
                  ]
               }),
               new CodeEditor(ID + "Editor", {
                  // height: 'auto',
                  colorTheme: "default",
                  type: "c_cpp",
                  value: "{/code}",
                  height: "calc(100% - 40px)",
                  change: function () {
                     console.log('Modified code editor')
                     this.getModel().setProperty("/modified", true);
                  }
               })
            ];
      },

      /** @brief Invoke dialog with server side code */
      onSaveAs: function() {

         const oTabItem = this.getSelectedTab();

         FileDialogController.SaveAs({
            websocket: this.websocket,
            filename: oTabItem.getModel().getProperty("/fullpath"),
            title: "Select file name to save",
            filter: "Any files",
            filters: ["Text files (*.txt)", "C++ files (*.cxx *.cpp *.c)", "Any files (*)"],
            onOk: fname => {
               this.setEditorFileName(oTabItem, fname);
               const sText = oTabItem.getModel().getProperty("/code");
               oTabItem.getModel().setProperty("/modified", false);
               this.websocket.send("SAVEFILE:" + JSON.stringify([fname, sText]));
            },
            onCancel: function() { },
            onFailure: function() { }
         });
      },

      /** @brief Handle the "Save" button press event */
      onSaveFile: function () {
         const oTabItem = this.getSelectedTab();
         const oModel = oTabItem.getModel();
         const sText = oModel.getProperty("/code");
         const fullpath = oModel.getProperty("/fullpath");
         if (!fullpath)
            return onSaveAs();
         oModel.setProperty("/modified", false);
         return this.websocket.send("SAVEFILE:" + JSON.stringify([fullpath, sText]));
      },

      reallyRunMacro: function () {
         const oTabItem = this.getSelectedTab();
         const oModel = oTabItem.getModel();
         const fullpath = oModel.getProperty("/fullpath");
         if (fullpath === undefined)
            return this.onSaveAs();
         return this.websocket.send("RUNMACRO:" + fullpath);
      },

      /** @brief Handle the "Run" button press event */
      onRunMacro: function () {
         this.saveCheck(this.reallyRunMacro.bind(this));
      },

      saveCheck: function(functionToRunAfter) {
         const oTabItem = this.getSelectedTab();
         const oModel = oTabItem.getModel();
         if (oModel.getProperty("/modified") === true) {
            MessageBox.confirm('The text has been modified! Do you want to save it?', {
               title: 'Unsaved file',
               icon: sap.m.MessageBox.Icon.QUESTION,
               onClose: oAction => {
                  if (oAction === MessageBox.Action.YES) {
                     this.onSaveFile();
                  } else if (oAction === MessageBox.Action.CANCEL) {
                     return;
                  }
                  return functionToRunAfter();
               },
               actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO, sap.m.MessageBox.Action.CANCEL]
            });
         } else {
            return functionToRunAfter();
         }
      },

      /** @summary Search TabContainerItem by key value */
      findTab: function(name) {
         let oTabContainer = this.byId("tabContainer");
         let items = oTabContainer.getItems();
         for(let i = 0; i< items.length; i++)
            if (items[i].getKey() === name)
               return items[i];
      },

      /** @summary Retuns current selected tab, instance of TabContainerItem */
      getSelectedTab: function() {
         let oTabContainer = this.byId("tabContainer");
         let items = oTabContainer.getItems();
         for(let i = 0; i< items.length; i++)
            if (items[i].getId() === oTabContainer.getSelectedItem())
               return items[i];
      },

      /** @summary Retuns code editor from the tab */
      getCodeEditor: function(tab) {
         let items = tab ? tab.getContent() : [];
         for (let n = 0; n < items.length; ++n)
            if (items[n].isA("sap.ui.codeeditor.CodeEditor"))
               return items[n];
      },

      /** @summary Extract the file name and extension
       * @desc Used to set the editor's model properties and display the file name on the tab element  */
      setEditorFileName: function (oTabElement, fullname) {
         let oEditor = this.getCodeEditor(oTabElement);
         if (!oEditor) return;
         let oModel = oTabElement.getModel();
         let ext = "txt";

         oModel.setProperty("/runEnabled", false);
         oModel.setProperty("/saveEnabled", true);

         let filename = fullname;
         let p = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
         if (p>0) filename = filename.substr(p+1);

         if (filename.lastIndexOf('.') > 0)
            ext = filename.substr(filename.lastIndexOf('.') + 1);

         switch (ext.toLowerCase()) {
            case "c":
            case "cc":
            case "cpp":
            case "cxx":
               oModel.setProperty("/runEnabled", false);
               // runButton.setEnabled(true);
               oEditor.setType('c_cpp');
               break;
            case "h":
            case "hh":
            case "hxx":
               oEditor.setType('c_cpp');
               break;
            case "f":
               oEditor.setType('fortran');
               break;
            case "htm":
            case "html":
               oEditor.setType('html');
               break;
            case "js":
               oEditor.setType('javascript');
               break;
            case "json":
               oEditor.setType('json');
               break;
            case "md":
               oEditor.setType('markdown');
               break;
            case "py":
               oEditor.setType('python');
               break;
            case "tex":
               oEditor.setType('latex');
               break;
            case "cmake":
            case "log":
            case "txt":
               oEditor.setType('plain_text');
               break;
            case "css":
               oEditor.setType('css');
               break;
            case "csh":
            case "sh":
               oEditor.setType('sh');
               break;
            case "xml":
               oEditor.setType('xml');
               break;
            default: // unsupported type
               if (filename.lastIndexOf('README') >= 0)
                  oEditor.setType('plain_text');
               else
                  return false;
               break;

         }
         oTabElement.setAdditionalText(filename);

         if (filename.lastIndexOf('.') > 0)
            filename = filename.substr(0, filename.lastIndexOf('.'));

         oModel.setProperty("/fullpath", fullname);
         oModel.setProperty("/filename", filename);
         oModel.setProperty("/ext", ext);
         return true;
      },

      /* ============================================= */
      /* =============== Settings menu =============== */
      /* ============================================= */

      _getSettingsMenu: async function () {

         if (!this._oSettingsMenu) {
            let fragment;
            await Fragment.load({name: "rootui5.browser.view.settingsmenu", controller: this}).then(function (oSettingsMenu) {
               fragment = oSettingsMenu;
            });
            if (fragment) {
               fragment.setModel(this._oSettingsModel);
               this.getView().addDependent(fragment);
               this._oSettingsMenu = fragment;
            }
         }
         return this._oSettingsMenu;
      },

      onSettingPress: async function () {
         let menu = await this._getSettingsMenu();

         this._oSettingsModel.setProperty("/ShowHiddenFiles", this.model.isShowHidden());
         this._oSettingsModel.setProperty("/SortMethod", this.model.getSortMethod());
         this._oSettingsModel.setProperty("/ReverseOrder", this.model.isReverseOrder());

         menu.open();
      },

      handleSettingsChange: function (oEvent) {
         let graphType = oEvent.getSource().sId.split("-")[1];
         this.drawingOptions[graphType] = oEvent.getSource().mProperties.value;
      },

      handleSeetingsConfirm: function() {
         let hidden = this._oSettingsModel.getProperty("/ShowHiddenFiles"),
             sort = this._oSettingsModel.getProperty("/SortMethod"),
             reverse = this._oSettingsModel.getProperty("/ReverseOrder"),
             changed = false;

         if (hidden != this.model.isShowHidden()) {
            changed = true;
            this.model.setShowHidden(hiden);
         }

         if (reverse != this.model.isReverseOrder()) {
            changed = true;
            this.model.setReverseOrder(reverse);
         }

         if (sort != this.model.getSortMethod()) {
            changed = true;
            this.model.setSortMethod(sort);
         }

         if (changed) {
            console.log('Settings changes - reload MODEL!!!');
            this.doReload(true);
         }
      },

      /* ============================================= */
      /* =============== Settings menu =============== */
      /* ============================================= */

      /* ========================================= */
      /* =============== Tabs menu =============== */
      /* ========================================= */

      /** @summary Add Tab event handler */
      addNewButtonPressHandler: async function (oEvent) {
         //TODO: Change to some UI5 function (unknown for now)
         let oButton = oEvent.getSource().mAggregations._tabStrip.mAggregations.addButton;

         // create action sheet only once
         if (!this._tabMenu) {
            let fragment;
            await Fragment.load({name: "rootui5.browser.view.tabsmenu", controller: this}).then(function (oFragment) {
               fragment = oFragment;
            });
            if (fragment) {
               this.getView().addDependent(fragment);
               this._tabMenu = fragment;
            }
         }
         this._tabMenu.openBy(oButton);
      },

      /** @summary handle creation of new tab */
      handleNewTab: function (oEvent) {
         let msg, txt = oEvent.getSource().getText();

         if (txt.indexOf("editor") >= 0)
            msg = "NEWEDITOR";
         else if (txt.indexOf("viewer") >= 0)
            msg = "NEWVIEWER";
         else if (txt.indexOf("Root 6") >= 0)
            msg = "NEWTCANVAS";
         else if (txt.indexOf("Root 7") >= 0)
            msg = "NEWRCANVAS";

         console.log("Sending", msg)

         if (this.isConnected && msg)
            this.websocket.send(msg);
      },

      /* ========================================= */
      /* =============== Tabs menu =============== */
      /* ========================================= */

      /* =========================================== */
      /* =============== Breadcrumbs =============== */
      /* =========================================== */

      updateBReadcrumbs: function(split) {
         // already array with all items inside
         let oBreadcrumbs = this.getView().byId("breadcrumbs");
         oBreadcrumbs.removeAllLinks();
         for (let i=-1; i<split.length; i++) {
            let txt = i<0 ? "/": split[i];
            if (i === split.length-1) {
               oBreadcrumbs.setCurrentLocationText(txt);
            } else {
               let link = new Link({text: txt});
               link.attachPress(this, this.onBreadcrumbsPress, this);
               oBreadcrumbs.addLink(link);
            }
         }
      },

      onBreadcrumbsPress: function(oEvent) {
         let sId = oEvent.getSource().getId();
         let oBreadcrumbs = oEvent.getSource().getParent();
         let oLinks = oBreadcrumbs.getLinks();
         let path = [];
         for (let i = 0; i < oLinks.length; i++) {
            if (i>0) path.push(oLinks[i].getText());
            if (oLinks[i].getId() === sId ) break;
         }
         this.websocket.send('CHPATH:' + JSON.stringify(path));
         this.doReload(true);
      },

      /* =========================================== */
      /* =============== Breadcrumbs =============== */
      /* =========================================== */

      /* ============================================ */
      /* =============== TabContainer =============== */
      /* ============================================ */

      tabSelectItem: function(oEvent) {
         let item = oEvent.getParameter('item');
         if (item && item.getKey())
            this.websocket.send("SELECT_TAB:" + item.getKey());
      },

      /** @brief Close Tab event handler */
      tabCloseHandler: function(oEvent) {
         // prevent the tab being closed by default
         oEvent.preventDefault();

         let oTabContainer = this.byId("tabContainer");
         let oItemToClose = oEvent.getParameter('item');

         /*if (oItemToClose.getName() === "Code Editor") {

            let count = 0;
            const items = oTabContainer.getItems();
            for (let i=0; i<items.length; i++) {
               if (items[i].getId().indexOf("CodeEditor") !== -1) {
                  count++
               }
            }
            if (count <= 1) {
               MessageToast.show("Sorry, you cannot close the Code Editor", {duration: 1500});
            } else {
               this.saveCheck(() => oTabContainer.removeItem(oItemToClose));
            }
         } */
         MessageBox.confirm('Do you really want to close the "' + oItemToClose.getName() + '" tab?', {
            onClose: oAction => {
               if (oAction === MessageBox.Action.OK) {
                  if (oItemToClose.getKey())
                     this.websocket.send("CLOSE_TAB:" + oItemToClose.getKey());

                  oTabContainer.removeItem(oItemToClose);

                  MessageToast.show('Closed the "' + oItemToClose.getName() + '" tab', {duration: 1500});
               }
            }
         });
      },

      /* ============================================ */
      /* =============== TabContainer =============== */
      /* ============================================ */

      /* ======================================== */
      /* =============== Terminal =============== */
      /* ======================================== */

      onTerminalSubmit: function(oEvent) {
         let command = oEvent.getSource().getValue();
         this.websocket.send("CMD:" + command);
         oEvent.getSource().setValue("");
         this.requestRootHist();
         this.requestLogs();
      },

      requestRootHist: function() {
         return this.websocket.send("ROOTHIST:");
      },

      updateRootHist: function (hist) {
         let pos = hist.lastIndexOf(',');
         hist = hist.substring(0,pos) + "" + hist.substring(pos+1);
         hist = hist.split(",");
         let json = {hist:[]};

         for(let i=0; i<hist.length; i++) {
            json.hist.push({name: hist[i] });

         }
         this.getView().byId("terminal-input").setModel(new JSONModel(json));
      },

      requestLogs: function() {
         return this.websocket.send("LOGS:");
      },

      updateLogs: function(logs) {
         this.getView().byId("output_log").setValue(logs);
      },

      /* ======================================== */
      /* =============== Terminal =============== */
      /* ======================================== */

      /* ========================================== */
      /* =============== ToolHeader =============== */
      /* ========================================== */

      onFullScreenPressLandscape: function () {
         let splitApp = this.getView().byId("SplitAppBrowser");
         let mode = splitApp.getMode();
         if(mode === "ShowHideMode") {
            splitApp.setMode("HideMode");
         } else {
            splitApp.setMode("ShowHideMode");
         }
      },

      onFullScreenPressPortrait: function () {
         let splitApp = this.getView().byId("SplitAppBrowser");
         if(splitApp.isMasterShown()) {
            splitApp.hideMaster();
         } else {
            splitApp.showMaster();
         }
      },

      onExpandMaster: function () {
         this.getView().byId('expandMaster').setVisible(false);
         this.getView().byId('shrinkMaster').setVisible(true);
         this.getView().byId('masterPage').getParent().addStyleClass('masterExpanded');
      },

      onShrinkMaster: function () {
         this.getView().byId('expandMaster').setVisible(true);
         this.getView().byId('shrinkMaster').setVisible(false);
         this.getView().byId('masterPage').getParent().removeStyleClass('masterExpanded');
      },

      /* ========================================== */
      /* =============== ToolHeader =============== */
      /* ========================================== */

      /** @summary Assign the "double click" event handler to each row */
      assignRowHandlers: function () {
         var rows = this.byId("treeTable").getRows();
         for (var k = 0; k < rows.length; ++k) {
            rows[k].$().dblclick(this.onRowDblClick.bind(this, rows[k]));
         }
      },

      sendDblClick: function (fullpath, opt) {
         let exec = "";
         if(this._oSettingsModel.getProperty("/DBLCLKRun")) exec = "exec";
         let msg = 'DBLCLK: ["' + fullpath + '","' + (opt || "") + '","' + exec + '"]';
         console.log('Sending ', msg);
         this.websocket.send(msg);
      },

      /** @summary Double-click event handler */
      onRowDblClick: function (row) {
         let ctxt = row.getBindingContext(),
            prop = ctxt ? ctxt.getProperty(ctxt.getPath()) : null,
            fullpath = (prop && prop.fullpath) ? prop.fullpath.substr(1, prop.fullpath.length - 2) : "";

         if (!fullpath) return;

         // do not use row._bHasChildren while it is not documented member of m.Row object
         if (!prop.isLeaf) {
            if (!prop.fullpath.endsWith(".root/")) {

               let oBreadcrumbs = this.getView().byId("breadcrumbs");
               let links = oBreadcrumbs.getLinks();
               let currentText = oBreadcrumbs.getCurrentLocationText();

               let path = "";
               if ((currentText == "/") || (links.length < 1)) {
                  path = prop.fullpath;
               } else {
                  path = "/";
                  for (let i = 1; i < links.length; i++)
                     path += links[i].getText() + "/";
                  path += currentText + prop.fullpath;
               }

               // TODO: use plain array also here to avoid any possible confusion
               this.websocket.send('CHDIR:' + path);
               return this.doReload(true);
            }
         }

         let className = this.getBaseClass(prop ? prop.className : ""),
             drawingOptions = className ? this.drawingOptions[className] : "";

         return this.sendDblClick(fullpath, drawingOptions || "");
      },

      getBaseClass: function(className) {
         if (typeof className !== 'string')
            className = "";
         if (className.match(/^TH1/)) {
            return "TH1";
         } else if (className.match(/^TH2/)) {
            return "TH2";
         }
         return className;
      },

      onWebsocketOpened: function(handle) {
         this.isConnected = true;

         if (this.model)
            this.model.sendFirstRequest(this.websocket);

      },

      onWebsocketClosed: function() {
         // when connection closed, close panel as well
         console.log('CLOSE WINDOW WHEN CONNECTION CLOSED');

         if (window) window.close();

         this.isConnected = false;
      },

     /** @summary Entry point for all data from server */
     onWebsocketMsg: function(handle, msg, offset) {

         if (typeof msg != "string")
            return console.error("Browser do not uses binary messages len = " + mgs.byteLength);

         let mhdr = msg.split(":")[0];
         msg = msg.substr(mhdr.length+1);

         switch (mhdr) {
         case "INMSG":
            this.processInitMsg(msg);
            break;
         case "EDITOR": { // update code editor
            let arr = JSON.parse(msg);

            let tab = this.findTab(arr[0]);

            if (tab) {
               this.setEditorFileName(tab, arr[1]);
               tab.getModel().setProperty("/code", arr[2]);
               tab.getModel().setProperty("/modified", false);
            }
            break;
         }
         case "IMAGE": { // update image viewer
            let arr = JSON.parse(msg);
            let tab = this.findTab(arr[0]);

            if (tab) {
               let filename = arr[1];
               let p = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
               if (p > 0) filename = filename.substr(p+1);
               tab.setAdditionalText(filename);
               let oViewer = tab.getContent()[0].getContent()[0];
               oViewer.setSrc(arr[2]);
            }
            break;
         }
         case "NEWTAB": {  // canvas created by server, need to establish connection
            let arr = JSON.parse(msg);
            this.createElement(arr[0], arr[1], arr[2]);
            break;
         }
         case "WORKPATH":
            this.updateBReadcrumbs(JSON.parse(msg));
            break;
         case "SELECT_TAB": // Selected the back selected canvas
           let oTabContainer = this.byId("tabContainer");
           let items = oTabContainer.getItems();
           for(let i = 0; i< items.length; i++) {
              if (items[i].getKey() === msg) {
                 oTabContainer.setSelectedItem(items[i]);
                 break;
              }
           }
           break;
         case "BREPL":   // browser reply
            if (this.model) {
               var bresp = JSON.parse(msg);
               this.model.processResponse(bresp);

               if (bresp.path === '/') {
                  var tt = this.getView().byId("treeTable");
                  var cols = tt.getColumns();
                  tt.autoResizeColumn(2);
                  tt.autoResizeColumn(1);
                  // for (var k=0;k<cols.length;++k)
                  //    tt.autoResizeColumn(k);
               }
            }
            break;
            case "HIST":
               this.updateRootHist(msg);
               break;
            case "LOGS":
               this.updateLogs(msg);
               break;
         default:
            console.error('Non recognized msg ' + mhdr + ' len=' + msg.length);
         }
      },

      /** @summary Show special message instead of nodes hierarchy */
      showTextInBrowser: function(text) {
         var br = this.byId("treeTable");
         br.collapseAll();
         if (!text || (text === "RESET")) {
            br.setNoData("");
            br.setShowNoData(false);

            this.model.setNoData(false);
            this.model.refresh();

         } else {
            br.setNoData(text);
            br.setShowNoData(true);
            this.model.setNoData(true);
            this.model.refresh();
         }
      },

      onBeforeRendering: function() {
         this.renderingDone = false;
      },

      onAfterRendering: function() {
         this.renderingDone = true;

         // this is how master width can be changed, may be extra control can be provided
         // var oSplitApp = this.getView().byId("SplitAppBrowser");
         // oSplitApp.getAggregation("_navMaster").$().css("width", "400px");
      },

      /** @summary Reload (refresh) file tree browser */
      onRealoadPress: function (oEvent) {
         this.doReload(true);
      },

      doReload: function(force) {
         if (this.standalone) {
            this.showTextInBrowser();
            this.paintFoundNodes(null);
            this.model.setFullModel(this.fullModel);
         } else {
            this.model.reloadMainModel(force);
         }
      },

      /** @summary Quit ROOT session */
      onQuitRootPress: function(oEvent) {
         this.websocket.send("QUIT_ROOT");
      },

      onSearch : function(oEvt) {
         this.changeItemsFilter(oEvt.getSource().getValue());
      },

      /** @summary Submit node search query to server, ignore in offline case */
      changeItemsFilter: function(query, from_handler) {

         if (!from_handler) {
            // do not submit immediately, but after very short timeout
            // if user types very fast - only last selection will be shown
            if (this.search_handler) clearTimeout(this.search_handler);
            this.search_handler = setTimeout(this.changeItemsFilter.bind(this, query, true), 1000);
            return;
         }

         delete this.search_handler;

         this.model.changeItemsFilter(query);
      },

      /** process initial message, now it is list of existing canvases */
      processInitMsg: function(msg) {
         var arr = JSROOT.parse(msg);
         if (!arr) return;

         this.updateBReadcrumbs(arr[0]);
         this.requestRootHist();
         this.requestLogs();

         for (var k=1; k<arr.length; ++k)
            this.createElement(arr[k][0], arr[k][1], arr[k][2]);
      },

      createElement: function(kind, par1, par2) {
         if (kind == "active") {
            const tabItem = this.findTab(par1);
            if (tabItem) this.byId("tabContainer").setSelectedItem(tabItem);
         } else if (kind == "edit") {
            this.createCodeEditor(par1, par2);
         } else if (kind == "image") {
            this.createImageViewer(par1, par2);
         } else
            this.createCanvas(kind, par1, par2);
      },

      createCanvas: function(kind, url, name) {
         console.log("Create canvas ", kind, url, name);
         if (!url || !name || (kind != "root6" && kind != "root7")) return;

         let oTabContainer = this.byId("tabContainer");
         let item = new TabContainerItem({
            name: "ROOT Canvas",
            key: name,
            additionalText: name,
            icon: "sap-icon://column-chart-dual-axis"
         });

         oTabContainer.addItem(item);

         // Change the selected tabs, only if it is new one, not the basic one
         if(name !== "rcanv1") {
            oTabContainer.setSelectedItem(item);
         }

         let conn = new JSROOT.WebWindowHandle(this.websocket.kind);

         // this is producing
         let addr = this.websocket.href, relative_path = url;
         if (relative_path.indexOf("../")==0) {
            var ddd = addr.lastIndexOf("/",addr.length-2);
            addr = addr.substr(0,ddd) + relative_path.substr(2);
         } else {
            addr += relative_path;
         }

         var painter = null;

         if (kind == "root7") {
            painter = new JSROOT.v7.RCanvasPainter(null, null);
         } else {
            painter = new JSROOT.TCanvasPainter(null, null);
         }

         painter.online_canvas = true; // indicates that canvas gets data from running server
         painter.embed_canvas = true;  // use to indicate that canvas ui should not close complete window when closing
         painter.use_openui = true;
         painter.batch_mode = false;
         painter._window_handle = conn;
         painter._window_handle_href = addr; // argument for connect

         XMLView.create({
            viewName: "rootui5.canv.view.Canvas",
            viewData: { canvas_painter: painter },
            height: "100%"
         }).then(oView => item.addContent(oView));
      },

   });

});
