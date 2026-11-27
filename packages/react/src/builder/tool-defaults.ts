/**
 * Each tool's default values and the schema version of the design JSON, as the Unlayer builder's editor defines them:
 * what toDesign() writes a part's values over (design.ts), and what fromDesign() reads a value an item doesn't have as. Plain data, in the editor's
 * key order (a design's JSON keeps it).
 */

/** The version of the editor's design schema these values are from. */
export const schemaVersion = 27;

export const BodyDefaults: Record<string, any> = {
  _styleGuide: null,
  popupPosition: "center",
  popupDisplayDelay: 0,
  popupWidth: "600px",
  popupHeight: "auto",
  borderRadius: "10px",
  contentAlign: "center",
  contentVerticalAlign: "middle",
  contentWidth: "500px",
  fontFamily: {
    label: "Arial",
    value: "arial,helvetica,sans-serif"
  },
  textColor: "#000000",
  popupBackgroundColor: "#FFFFFF",
  popupBackgroundImage: {
    url: "",
    fullWidth: true,
    repeat: "no-repeat",
    size: "cover",
    position: "center"
  },
  popupOverlay_backgroundColor: "rgba(0, 0, 0, 0.1)",
  popupCloseButton_position: "top-right",
  popupCloseButton_backgroundColor: "#DDDDDD",
  popupCloseButton_iconColor: "#000000",
  popupCloseButton_borderRadius: "0px",
  popupCloseButton_margin: "0px",
  popupCloseButton_action: {
    name: "close_popup",
    attrs: {
      onClick: "document.querySelector('.u-popup-container').style.display = 'none';"
    }
  },
  language: {},
  backgroundColor: "#F7F8F9",
  documentSize: "A4",
  documentOrientation: "portrait",
  documentMargin: "96px",
  preheaderText: "",
  linkStyle: {
    body: true,
    linkColor: "#0000ee",
    linkHoverColor: "#0000ee",
    linkUnderline: true,
    linkHoverUnderline: true
  },
  backgroundImage: {
    url: "",
    fullWidth: true,
    repeat: "no-repeat",
    size: "custom",
    position: "center"
  },
  accessibilityTitle: "",
  _meta: {}
};

export const RowDefaults: Record<string, any> = {
  displayCondition: null,
  columns: false,
  _styleGuide: null,
  backgroundColor: "",
  columnsBackgroundColor: "",
  backgroundImage: {
    url: "",
    fullWidth: true,
    repeat: "no-repeat",
    size: "custom",
    position: "center"
  },
  padding: "0px",
  anchor: "",
  noStackMobile: false,
  _meta: {},
  selectable: true,
  draggable: true,
  duplicatable: true,
  deletable: true,
  hideable: true,
  locked: false
};

export const ColumnDefaults: Record<string, any> = {
  backgroundColor: "",
  padding: "0px",
  border: {},
  borderRadius: "0px",
  _meta: {},
  deletable: true,
  locked: false
};

export const ButtonDefaults: Record<string, any> = {
  href: {
    name: "web",
    values: {
      href: "",
      target: "_blank"
    }
  },
  buttonColors: {
    color: "#FFFFFF",
    backgroundColor: "#0879A1",
    hoverColor: "#FFFFFF",
    hoverBackgroundColor: "#0879A1"
  },
  size: {
    autoWidth: true,
    width: "100%"
  },
  fontSize: "14px",
  lineHeight: "120%",
  textAlign: "center",
  padding: "10px 20px",
  border: {},
  borderRadius: "4px"
};

export const DividerDefaults: Record<string, any> = {
  width: "100%",
  border: {
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "#BBBBBB"
  },
  textAlign: "center"
};

export const HeadingDefaults: Record<string, any> = {
  headingType: "h1",
  fontSize: "22px",
  textAlign: "left",
  lineHeight: "140%",
  linkStyle: {
    inherit: true,
    linkColor: "#0000ee",
    linkHoverColor: "#0000ee",
    linkUnderline: true,
    linkHoverUnderline: true
  }
};

export const HtmlDefaults: Record<string, any> = {
  html: "<strong>Hello, world!</strong>"
};

export const ImageDefaults: Record<string, any> = {
  src: {
    url: "https://cdn.tools.unlayer.com/image/placeholder.png",
    width: 1600,
    height: 400
  },
  textAlign: "center",
  altText: "",
  action: {
    name: "web",
    values: {
      href: "",
      target: "_blank"
    }
  }
};

export const MenuDefaults: Record<string, any> = {
  menu: {
    items: []
  },
  fontSize: "14px",
  textColor: "#444444",
  linkColor: "#0068A5",
  align: "center",
  layout: "horizontal",
  separator: "",
  padding: "5px 15px"
};

export const ParagraphDefaults: Record<string, any> = {
  fontSize: "14px",
  textAlign: "left",
  lineHeight: "140%",
  linkStyle: {
    inherit: true,
    linkColor: "#0000ee",
    linkHoverColor: "#0000ee",
    linkUnderline: true,
    linkHoverUnderline: true
  }
};

export const SocialDefaults: Record<string, any> = {
  icons: {
    iconType: "circle",
    icons: []
  },
  align: "center",
  iconSize: 32,
  spacing: 5
};

/** A cell's rich text as the editor writes one: a paragraph of these words (none for an empty cell). */
const cellText = (words: string) =>
  `{"root":{"children":[{"children":[${words ? `{"detail":0,"format":0,"mode":"normal","style":"","text":"${words}","type":"extended-text","version":1}` : ""}],"format":"","indent":0,"type":"extended-paragraph","version":1,"textFormat":0}],"format":"","indent":0,"type":"root","version":1}}`;
const emptyCell = { textJson: cellText(""), text: "", width: 50 };

/** The table. */
export const TableDefaults: Record<string, any> = {
  table: {
    headers: [{ cells: [{ textJson: cellText("Add header text"), text: "<p>Add header text</p>", width: 50 }, emptyCell], height: 50 }],
    rows: [
      { cells: [{ textJson: cellText("Add text"), text: "<p>Add text</p>", width: 50 }, emptyCell], height: 50 },
      { cells: [emptyCell, emptyCell], height: 50 }
    ],
    footers: [{ cells: [emptyCell, emptyCell], height: 50 }]
  },
  columns: 2,
  rows: 2,
  border: {
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "#CCC",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    borderLeftColor: "#CCC",
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: "#CCC",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: "#CCC"
  },
  stripedRows: false,
  stripedRowsBackgroundColor: "#CCC",
  enableHeader: true,
  repeatHeaderOnEachPage: true,
  headerBackgroundColor: "#DDDDDD",
  headerFontWeight: 700,
  headerFontSize: "14px",
  headerTextAlign: "left",
  headerVerticalAlign: "middle",
  headerPadding: "10px",
  contentBackgroundColor: "#FFFFFF",
  contentFontSize: "14px",
  contentTextAlign: "left",
  contentVerticalAlign: "middle",
  contentLineHeight: "140%",
  contentPadding: "10px",
  enableFooter: false,
  repeatFooterOnEachPage: true,
  footerBackgroundColor: "#DDDDDD",
  footerFontWeight: 700,
  footerFontSize: "14px",
  footerTextAlign: "left",
  footerVerticalAlign: "middle",
  footerPadding: "10px",
  linkStyle: {
    body: true,
    linkColor: "#0000ee",
    linkHoverColor: "#0000ee",
    linkUnderline: true,
    linkHoverUnderline: true
  }
};

export const TextDefaults: Record<string, any> = {
  fontSize: "14px",
  textAlign: "left",
  lineHeight: "140%",
  linkStyle: {
    inherit: true,
    linkColor: "#0000ee",
    linkHoverColor: "#0000ee",
    linkUnderline: true,
    linkHoverUnderline: true
  }
};

export const VideoDefaults: Record<string, any> = {
  video: {}
};

export const FormDefaults: Record<string, any> = {
  action: "",
  method: "GET",
  fields: [
    { name: "name", label: "Name", type: "text", required: false, showLabel: true, placeholder_text: "" },
    { name: "email", label: "Email", type: "email", required: true, showLabel: true, placeholder_text: "" },
  ],
  buttonText: "Submit",
  containerPadding: "10px",
};
