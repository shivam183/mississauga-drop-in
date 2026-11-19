import { Suspense } from "react";
import { DetailsLoading } from "@/components/DetailsPreview";
import { DETAILS_TITLE_ID } from "@/components/detailsIds";
import { CloseButton, Modal } from "@/components/Modal";
import { RegisteredDetailsRoute, type RegisteredRouteProps } from "@/components/RegisteredDetails";

/** /registered/{id} opened from the list: the details as a popup over it. */
export default function RegisteredModal(props: RegisteredRouteProps) {
  return (
    <Modal labelledBy={DETAILS_TITLE_ID}>
      <Suspense fallback={<DetailsLoading close={<CloseButton />} />}>
        <RegisteredDetailsRoute {...props} close={<CloseButton />} />
      </Suspense>
    </Modal>
  );
}
