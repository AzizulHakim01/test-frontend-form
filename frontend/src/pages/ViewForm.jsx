import React, { useRef, useState } from "react";
import Layout from "../components/Layout";
import { useDispatch, useSelector } from "react-redux";
import { clearFiles, selectFormData } from "../reducers/formDataReducer";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import axios from "axios";
import { message } from "antd";
import Loader from "./Loader";
import SignatureCanvas from "react-signature-canvas";
import { setSignature } from "../reducers/formDataReducer";
import html2pdf from 'html2pdf.js';

const selectFiles = (state) => state.form.formData.files;
const ViewForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const formData = useSelector(selectFormData);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const files = useSelector(selectFiles);
  const [signature, setSignature] = useState();
  const [result, setResult] = useState(null);

  // Signature Handlers
  const clearHandler = () => {
    signature.clear();
    setResult(null);
  };

  const saveHandler = () => {
    const data = signature.getTrimmedCanvas().toDataURL("image/png");
    setResult(data);
    dispatch(setSignature(data)); // Dispatch action to save signature to Redux
  };

  //

  const handlePrint = useReactToPrint({
    content: () => document.getElementById("print-content"),
  });

  const handleDownload = () => {
    const element = document.getElementById("print-content");
  
    // Ensure that the input element exists
    if (element) {
      html2pdf(element, {
        margin: 0,
        filename: `${formData.business_name}_Fund_Request_Application.pdf`,
        image: { type: 'png', quality: 1 },
        html2canvas: { dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      });
    } else {
      console.error("Element with id 'print-content' not found");
    }
  };
  // ... (existing code)

  // Assuming 'generatePdf' function and 'files' array are defined elsewhere
  // Assuming 'generatePdf' function and 'files' array are defined elsewhere
  const generatePdf = () => {
    return new Promise((resolve, reject) => {
      const input = document.getElementById("print-content");

      if (!input) {
        reject(new Error("Element with id 'print-content' not found"));
        return;
      }

      const inputHeight = input.scrollHeight;
      const inputWidth = input.scrollWidth;

      html2canvas(input, {
        scrollY: -window.scrollY,
        windowHeight: document.documentElement.scrollHeight,
        width: inputWidth,
        height: inputHeight,
        x: 0,
        y: 0,
      }).then((canvas) => {
        const contentWidth = canvas.width;
        const contentHeight = canvas.height;

        const pdf = new jsPDF({
          unit: "px",
          format: [contentWidth, contentHeight],
        });

        let position = 0;

        const imageData = canvas.toDataURL("image/jpeg", 1.0);
        pdf.addImage(
          imageData,
          "JPEG",
          0,
          position,
          contentWidth,
          contentHeight
        );
        position -= contentHeight;

        const pageCount = Math.ceil(inputHeight / contentHeight);

        const addNextPage = (pageNumber) => {
          if (pageNumber >= pageCount) {
            resolve(pdf.output("dataurlstring"));
            return;
          }

          const nextPageHeight = Math.min(
            contentHeight,
            inputHeight - pageNumber * contentHeight
          );

          html2canvas(input, {
            scrollY: -window.scrollY,
            windowHeight: document.documentElement.scrollHeight,
            width: inputWidth,
            height: inputHeight,
            x: 0,
            y: pageNumber * contentHeight,
          }).then((nextCanvas) => {
            const nextImageData = nextCanvas.toDataURL("image/jpeg", 1.0);
            pdf.addPage([contentWidth, nextPageHeight]);
            pdf.addImage(
              nextImageData,
              "JPEG",
              0,
              position,
              contentWidth,
              nextPageHeight
            );
            position -= nextPageHeight;

            addNextPage(pageNumber + 1);
          });
        };

        addNextPage(1);
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      // Generate PDF and convert to Base64
      const pdfDataUrl = await generatePdf();

      const formDataToSend = new FormData();
      formDataToSend.append("pdfDataUrl", pdfDataUrl);
      formDataToSend.append("formData", JSON.stringify(formData));

       // Append signature as a file
    if (formData.signature) {
      const signatureBlob = await fetch(formData.signature).then((res) =>
        res.blob()
      );
      const signatureFile = new File([signatureBlob], "signature.png", {
        type: "image/png",
      });
      formDataToSend.append("signature", signatureFile);
    }

      // Use axios to fetch and append files
      await Promise.all(
        files.slice(0, 20).map(async (file, index) => {
          try {
            const response = await axios.get(file.URL, {
              responseType: "arraybuffer",
            });

            // Convert ArrayBuffer to Blob
            const blob = new Blob([response.data]);

            // Ensure that the filename ends with ".pdf"
            const attachmentName = `${formData.business_name}_${file.name}.pdf`;

            // Create a File object from the Blob
            const fileObject = new File([blob], attachmentName, {
              type: "application/pdf",
            });

            // Append the File to FormData
            formDataToSend.append("files", fileObject);
          } catch (error) {
            console.error(`Error fetching file ${file.name}:`, error);
          }
        })
      );

      // Log formDataToSend for debugging
    for (let pair of formDataToSend.entries()) {
      console.log(pair[0] + ', ' + pair[1]);
    }

      const response = await axios.post(
        "https://test-server-form.onrender.com/send-email",
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      navigate("/thank");
      message.success("Form submitted successfully");
    } catch (error) {
      console.error("Error sending email:", error);
      if (error.response) {
        console.log("Server response data:", error.response.data);
        console.log("Server response status:", error.response.status);
        console.log("Server response headers:", error.response.headers);
      }
      message.error("Failed to send email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    navigate("/apply");
  };
  return (
    <Layout>
      {isLoading && <Loader />}
      <div className="px-4">
        <div className="max-w-screen-xl  mx-auto" id="print-content">
          <img src="/images/logo.png" alt="" className="w-24 mx-auto" />
          <h1 className="text-[#00d1a9] text-center uppercase font-bold text-2xl">
            Merchant Funding Request Form
          </h1>
          <p className="text-center font-medium text-zinc-600">
            Thanks for being with us
          </p>
          <div className="border-2 border-[#00d1a9] p-8 rounded-md mt-2">
            <div className="text-center">
              <div className=""></div>
              <h1 className="text-xl font-bold text-slate-700 text-center">
                Business Details
              </h1>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4  text-md font-medium text-slate-700">
              <p>
                Name of the merchant : <span>{formData.business_name}</span>
              </p>
              <p>
                Doing Business As: <span>{formData.business_type}</span>
              </p>
              <p>
                Business Email: <span>{formData.business_email}</span>
              </p>
              <p>
                Business Number: <span>{formData.business_number}</span>
              </p>
              <p>
                Funding Amount Required: <span>{formData.amount_asking}</span>
              </p>
              <p>
                Business Start Date : <span>{formData.business_date}</span>
              </p>
              <p>
                Adress : <span>{formData.address}</span>
              </p>
              <p>
                City : <span>{formData.city}</span>
              </p>
              <p>
                State : <span>{formData.state}</span>
              </p>
              <p>
                Business Industry : <span>{formData.industry}</span>
              </p>
            </div>
            <h1 className="text-xl font-bold text-slate-700 text-center capitalize">
              Economic profile
            </h1>
            <div className="grid grid-cols-1 gap-4 mt-4 text-md font-medium text-slate-700">
              <p>
                Average Monthly Gross Income :{" "}
                <span>{formData.monthly_revenue}</span>
              </p>
              <p>
                Credit Score: <span>{formData.fico}</span>
              </p>
              <p>
                Current Month Revenue: <span>{formData.current_month}</span>
              </p>
              <p>
                Last Month Revenue : <span>{formData.last_month}</span>
              </p>
              <p>
                Month before Last Revenue :{" "}
                <span>{formData.before_last_month}</span>
              </p>
              <p>
                Current Cash Advances :
                {formData.history !== "" ? <span>Yes</span> : <span>No</span>}
              </p>
              <p className={`${formData.history === "" ? "hidden" : ""}`}>
                History : <span>{formData.history}</span>
              </p>
              <p>
                State : <span>{formData.state}</span>
              </p>
              <p>
                Purpose of the Capital : <span>{formData.purpose_capital}</span>
              </p>

              <p className="font-bold text-md">
                <span>Application Signed date: </span>
                {formData.date}
              </p>
              {
                result == null? <div className="grid gap-3 w-96">
                <p>Please Sign Below:</p>
                <SignatureCanvas
                  ref={(ref) => setSignature(ref)}
                  penColor="green"
                  canvasProps={{
                    width: 500,
                    height: 200,
                    className: "sigCanvas border-4 border-red-500 rounded-md",
                  }}
                />
                <button
                  onClick={saveHandler}
                  type="button"
                  className="text-gray-900 bg-gradient-to-r from-lime-200 via-lime-400 to-lime-500 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-lime-300 dark:focus:ring-lime-800 shadow-lg shadow-lime-500/50 dark:shadow-lg dark:shadow-lime-800/80 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                >
                  Save
                </button>
                <button
                  onClick={clearHandler}
                  type="button"
                  className="text-white bg-gradient-to-r from-red-400 via-red-500 to-red-600 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-red-300 dark:focus:ring-red-800 shadow-lg shadow-red-500/50 dark:shadow-lg dark:shadow-red-800/80 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                >
                  Clear
                </button>
                <br />
                <br />
              </div>
              :
              <div className="">
                <img src={result} alt="signature" />
              </div>
              }
              <p>
                Files Attactched :{" "}
                {formData.files.map((file) => {
                  return (
                    <div className="text-slate-700 lowercase" key={file.id}>
                      {file.name}
                    </div>
                  );
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-4 gap-8">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-white font-semibold transition-all"
        >
          Print
        </button>
        <button
          onClick={handleDownload}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md text-white font-semibold transition-all"
        >
          Download
        </button>
        <button
          onClick={handleSubmit}
          className="bg-[#00d1a9] hover:bg-[#3cad99] px-4 py-2 rounded-md text-white font-semibold transition-all"
        >
          Submit
        </button>
        <button
          onClick={handleEdit}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-white font-semibold transition-all"
        >
          Edit
        </button>
      </div>
    </Layout>
  );
};

export default ViewForm;
