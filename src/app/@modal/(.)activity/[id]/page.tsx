import { Suspense } from "react";
import { ActivityDetailsRoute, type ActivityRouteProps } from "@/components/ActivityDetails";
import { DetailsLoading } from "@/components/DetailsPreview";
import { DETAILS_TITLE_ID } from "@/components/detailsIds";
import { CloseButton, Modal } from "@/components/Modal";

/** /activity/{id} opened from the list: the details as a popup over it. */
export default function ActivityModal(props: ActivityRouteProps) {
  return (
    <Modal labelledBy={DETAILS_TITLE_ID}>
      <Suspense fallback={<DetailsLoading close={<CloseButton />} />}>
        <ActivityDetailsRoute {...props} close={<CloseButton />} />
      </Suspense>
    </Modal>
  );
}
